import { Hono } from 'hono';
import { deleteUserFiles } from '../lib/cloudinary.js';
import { query, withTransaction } from '../lib/db.js';
import { mailer } from '../lib/email.js';
import { HttpError } from '../lib/errors.js';
import { SECTION_NAMES, productIssues, productsCsv } from '../lib/export.js';
import { UUID_RE, background, parseBody, publicUser, requireAuth, requireRole, requireStaff } from '../lib/http.js';
import { getSettings, notificationPrefs, saveSettings } from '../lib/settings.js';
import { auth } from '../lib/supabase.js';
import { createInvite, inviterName, reissueInvite } from '../lib/tokens.js';
import { SECTIONS } from '../validation/onboarding.js';
import {
  accountSchema,
  changeRequestSchema,
  clientInviteSchema,
  deleteClientSchema,
  exportSettingsSchema,
  leadStageSchema,
  notificationsSchema,
  onboardingSettingsSchema,
  roleSchema,
  staffInviteSchema,
} from '../validation/admin.js';

const router = new Hono();
router.use(requireAuth, requireStaff);
const adminOnly = requireRole('admin');

const TOTAL_SECTIONS = SECTION_NAMES.length;

const notFound = () => new HttpError(404, 'This client no longer exists.');
const displayName = (row) => row.business_info?.name?.trim() || row.business_name || row.email;

/** The status the admin sees: one of invited, notstarted, progress, changes, submitted. */
function clientStatus(row) {
  if (row.status === 'submitted') return 'submitted';
  if (row.status === 'changes_requested') return 'changes';
  return row.current_step === 0 && Object.keys(row.business_info ?? {}).length === 0 ? 'notstarted' : 'progress';
}

const clientSummary = (row) => {
  const status = clientStatus(row);
  return {
    id: row.user_id,
    kind: 'client',
    name: displayName(row),
    contact: row.full_name ?? '',
    email: row.email,
    phone: row.business_info?.phone ?? '',
    status,
    done: status === 'submitted' ? TOTAL_SECTIONS : Math.min(row.current_step, TOTAL_SECTIONS),
    emailVerified: Boolean(row.email_verified_at),
    archived: Boolean(row.archived_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
};

const CLIENT_SQL = `
  SELECT s.*, u.email, u.business_name, u.full_name, u.email_verified_at, u.archived_at, u.created_at AS joined_at
  FROM onboarding_submissions s JOIN users u ON u.id = s.user_id
  WHERE u.role = 'client'`;

async function loadClient(userId, db = { query }) {
  if (!UUID_RE.test(userId)) throw notFound();
  const { rows } = await db.query(`${CLIENT_SQL} AND u.id = $1`, [userId]);
  if (!rows[0]) throw notFound();
  return rows[0];
}

const fileSlug = (row) => displayName(row).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'client';

// ---------------------------------------------------------------- Clients

router.get('/clients', async (c) => {
  const [clients, invites] = await Promise.all([
    query(CLIENT_SQL),
    query(
      `SELECT *, (expires_at <= now()) AS expired FROM invites
       WHERE kind = 'client' AND accepted_at IS NULL AND revoked_at IS NULL`,
    ),
  ]);
  return c.json({
    clients: [
      ...clients.rows.map(clientSummary),
      ...invites.rows.map((i) => ({
        id: i.id,
        kind: 'invite',
        name: i.business_name,
        contact: i.contact_name ?? '',
        email: i.email,
        phone: '',
        status: 'invited',
        done: 0,
        archived: false,
        invitedAt: i.updated_at,
        inviteExpired: i.expired,
        updatedAt: i.updated_at,
      })),
    ],
  });
});

router.get('/clients/:id', async (c) => {
  const row = await loadClient(c.req.param('id'));
  const { includeNoImages } = await getSettings('export');
  const { rows: requests } = await query(
    `SELECT c.*, u.full_name AS created_by_name FROM change_requests c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.submission_id = $1 ORDER BY c.created_at DESC`,
    [row.id],
  );
  return c.json({
    client: clientSummary(row),
    submission: Object.fromEntries(Object.entries(SECTIONS).map(([key, { column }]) => [key, row[column]])),
    issues: productIssues(row),
    // Lets the page warn that products without images will be left out of the CSV.
    exportIncludesNoImages: includeNoImages,
    // The asset zip is put together in the browser, straight from Cloudinary, so its name comes from here.
    fileSlug: fileSlug(row),
    changeRequests: requests.map((r) => ({
      id: r.id,
      step: r.step,
      section: SECTION_NAMES[r.step],
      message: r.message,
      items: r.flagged_items,
      createdAt: r.created_at,
      createdBy: r.created_by_name,
      resolvedAt: r.resolved_at,
    })),
  });
});

router.post('/clients/:id/change-requests', adminOnly, async (c) => {
  const { step, message, items } = await parseBody(c, changeRequestSchema);
  const row = await withTransaction(async (db) => {
    const client = await loadClient(c.req.param('id'), db);
    await db.query(
      `INSERT INTO change_requests (submission_id, step, message, flagged_items, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [client.id, step, message, JSON.stringify(items), c.get('user').id],
    );
    await db.query(`UPDATE onboarding_submissions SET status = 'changes_requested' WHERE id = $1`, [client.id]);
    return client;
  });
  background(mailer.sendChangesRequested({ to: row.email, contactName: row.full_name, sectionName: SECTION_NAMES[step], message }));
  return c.json({ ok: true }, 201);
});

const setArchived = (archived) => async (c) => {
  const row = await loadClient(c.req.param('id'));
  await query(`UPDATE users SET archived_at = ${archived ? 'now()' : 'NULL'} WHERE id = $1`, [row.user_id]);
  return c.json({ ok: true });
};
router.post('/clients/:id/archive', adminOnly, setArchived(true));
router.post('/clients/:id/restore', adminOnly, setArchived(false));

router.delete('/clients/:id', adminOnly, async (c) => {
  const { confirmName } = await parseBody(c, deleteClientSchema);
  const row = await loadClient(c.req.param('id'));
  if (confirmName.trim() !== displayName(row)) throw new HttpError(400, 'Type the business name exactly to confirm.');

  await query(`UPDATE invites SET revoked_at = now() WHERE email = $1 AND accepted_at IS NULL AND revoked_at IS NULL`, [row.email]);
  // Removing the sign-in account cascades to the user, their submission and its change requests.
  await auth.deleteUser(row.user_id);
  background(deleteUserFiles(row.user_id));
  return c.body(null, 204);
});

router.get('/clients/:id/products.csv', async (c) => {
  const row = await loadClient(c.req.param('id'));
  const csv = productsCsv(row, await getSettings('export'), displayName(row));
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileSlug(row)}-products.csv"`,
  });
});

// ---------------------------------------------------------------- Invites (clients and staff)

const emailInUse = () =>
  new HttpError(409, 'That email already has an account or invite.', {
    fields: { email: 'That email already has an account or invite.' },
  });

async function assertEmailFree(email, db) {
  const { rows } = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (rows[0]) throw emailInUse();
}

async function sendInviteEmail(invite, token) {
  const inviter = await inviterName(invite.invited_by);
  if (invite.kind === 'client') {
    return mailer.sendClientInvite({
      to: invite.email,
      token,
      businessName: invite.business_name,
      contactName: invite.contact_name,
      note: invite.note,
      inviterName: inviter,
    });
  }
  return mailer.sendStaffInvite({ to: invite.email, token, role: invite.role, inviterName: inviter });
}

router.post('/invites', adminOnly, async (c) => {
  const { businessName, contactName, email, note } = await parseBody(c, clientInviteSchema);
  let created;
  try {
    created = await withTransaction(async (db) => {
      await assertEmailFree(email, db);
      return createInvite(db, { kind: 'client', email, role: 'client', businessName, contactName, note: note || null, invitedBy: c.get('user').id });
    });
  } catch (err) {
    if (err.code === '23505') throw emailInUse();
    throw err;
  }
  await sendInviteEmail(created.invite, created.token);
  return c.json({ invite: { id: created.invite.id, email } }, 201);
});

router.post('/invites/:id/resend', adminOnly, async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) throw new HttpError(404, 'This invite no longer exists.');
  const reissued = await reissueInvite({ query }, id);
  if (!reissued) throw new HttpError(404, 'This invite no longer exists.');
  await sendInviteEmail(reissued.invite, reissued.token);
  return c.json({ ok: true });
});

router.delete('/invites/:id', adminOnly, async (c) => {
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) throw new HttpError(404, 'This invite no longer exists.');
  const { rowCount } = await query(
    'UPDATE invites SET revoked_at = now() WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL',
    [id],
  );
  if (!rowCount) throw new HttpError(404, 'This invite no longer exists.');
  return c.body(null, 204);
});

// ---------------------------------------------------------------- Leads

const leadOut = (l) => ({
  id: l.id,
  businessName: l.business_name,
  contactName: l.contact_name,
  businessType: l.business_type,
  phone: l.phone,
  email: l.email,
  budget: l.budget,
  timeline: l.timeline,
  callDate: l.call_date, // a plain YYYY-MM-DD string (see db.js)
  stage: l.stage,
  createdAt: l.created_at,
});

router.get('/leads', async (c) => {
  const { rows } = await query('SELECT * FROM leads ORDER BY coalesce(call_date, created_at::date) DESC, created_at DESC');
  return c.json({ leads: rows.map(leadOut) });
});

router.patch('/leads/:id', adminOnly, async (c) => {
  const { stage } = await parseBody(c, leadStageSchema);
  const id = c.req.param('id');
  if (!UUID_RE.test(id)) throw new HttpError(404, 'This lead no longer exists.');
  const { rows } = await query('UPDATE leads SET stage = $2 WHERE id = $1 RETURNING *', [id, stage]);
  if (!rows[0]) throw new HttpError(404, 'This lead no longer exists.');
  return c.json({ lead: leadOut(rows[0]) });
});

// ---------------------------------------------------------------- Team

router.get('/team', async (c) => {
  const [members, invites] = await Promise.all([
    query(`SELECT id, email, full_name, role FROM users WHERE role IN ('admin', 'viewer') ORDER BY created_at`),
    query(
      `SELECT id, email, role, (expires_at <= now()) AS expired FROM invites
       WHERE kind = 'staff' AND accepted_at IS NULL AND revoked_at IS NULL ORDER BY created_at`,
    ),
  ]);
  return c.json({
    members: members.rows.map((m) => ({ id: m.id, kind: 'member', email: m.email, name: m.full_name ?? '', role: m.role })),
    invites: invites.rows.map((i) => ({ id: i.id, kind: 'invite', email: i.email, name: '', role: i.role, expired: i.expired })),
  });
});

router.post('/team/invites', adminOnly, async (c) => {
  const { email, role } = await parseBody(c, staffInviteSchema);
  let created;
  try {
    created = await withTransaction(async (db) => {
      await assertEmailFree(email, db);
      return createInvite(db, { kind: 'staff', email, role, invitedBy: c.get('user').id });
    });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'That person already has access.', { fields: { email: 'That person already has access.' } });
    throw err;
  }
  await sendInviteEmail(created.invite, created.token);
  return c.json({ invite: { id: created.invite.id, email, role } }, 201);
});

/** Keeps at least one admin, so nobody can lock the whole team out of Settings. */
async function assertAnotherAdmin(db, userId) {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND id <> $1`, [userId]);
  if (rows[0].n === 0) throw new HttpError(400, 'The team needs at least one admin.');
}

async function loadMember(db, id, me) {
  if (!UUID_RE.test(id)) throw new HttpError(404, 'That person is no longer on the team.');
  if (id === me) throw new HttpError(400, "You can't change your own access.");
  const { rows } = await db.query(`SELECT id, role FROM users WHERE id = $1 AND role IN ('admin', 'viewer') FOR UPDATE`, [id]);
  if (!rows[0]) throw new HttpError(404, 'That person is no longer on the team.');
  return rows[0];
}

router.patch('/team/:id', adminOnly, async (c) => {
  const { role } = await parseBody(c, roleSchema);
  await withTransaction(async (db) => {
    const member = await loadMember(db, c.req.param('id'), c.get('user').id);
    if (member.role === 'admin' && role !== 'admin') await assertAnotherAdmin(db, member.id);
    await db.query('UPDATE users SET role = $2 WHERE id = $1', [member.id, role]);
  });
  return c.json({ ok: true });
});

router.delete('/team/:id', adminOnly, async (c) => {
  const member = await withTransaction(async (db) => {
    const m = await loadMember(db, c.req.param('id'), c.get('user').id);
    if (m.role === 'admin') await assertAnotherAdmin(db, m.id);
    // Take away access at once; the sign-in account is removed just after.
    await db.query('DELETE FROM users WHERE id = $1', [m.id]);
    return m;
  });
  await auth.deleteUser(member.id);
  return c.body(null, 204);
});

// ---------------------------------------------------------------- Settings

router.get('/settings', adminOnly, async (c) => {
  const [onboarding, exportSettings] = await Promise.all([getSettings('onboarding'), getSettings('export')]);
  return c.json({ settings: { onboarding, export: exportSettings } });
});

router.put('/settings/onboarding', adminOnly, async (c) => {
  const body = await parseBody(c, onboardingSettingsSchema);
  return c.json({ settings: await saveSettings('onboarding', body, c.get('user').id) });
});

router.put('/settings/export', adminOnly, async (c) => {
  const body = await parseBody(c, exportSettingsSchema);
  return c.json({ settings: await saveSettings('export', body, c.get('user').id) });
});

// ---------------------------------------------------------------- The signed-in staff member

router.put('/me/account', async (c) => {
  const me = c.get('user');
  const { fullName, email, currentPassword, newPassword } = await parseBody(c, accountSchema);
  const changingEmail = email !== me.email;

  if (changingEmail || newPassword) {
    const ok = currentPassword && (await auth.passwordMatches(me.email, currentPassword));
    if (!ok) {
      const message = currentPassword
        ? "That password isn't right."
        : changingEmail
          ? 'Enter your current password to change your email.'
          : 'Enter your current password.';
      throw new HttpError(400, message, { fields: { currentPassword: message } });
    }
  }

  const taken = () =>
    new HttpError(409, 'Another account already uses that email.', { fields: { email: 'Another account already uses that email.' } });

  if (changingEmail || newPassword) {
    const updated = await auth.updateUser(me.id, { email: changingEmail ? email : undefined, password: newPassword || undefined });
    if (!updated) throw taken();
  }
  try {
    const { rows } = await query(
      `UPDATE users SET full_name = $2, email = $3 WHERE id = $1
       RETURNING id, email, role, business_name, full_name, email_verified_at`,
      [me.id, fullName, email],
    );
    return c.json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw taken();
    throw err;
  }
});

router.get('/me/notifications', (c) => c.json({ notifications: notificationPrefs(c.get('user')) }));

router.put('/me/notifications', async (c) => {
  const body = await parseBody(c, notificationsSchema);
  const { rows } = await query(
    'UPDATE users SET notification_prefs = $2::jsonb WHERE id = $1 RETURNING email, notification_prefs',
    [c.get('user').id, JSON.stringify(body)],
  );
  return c.json({ notifications: notificationPrefs(rows[0]) });
});

export default router;
