import { Router } from 'express';
import bcrypt from 'bcrypt';
import { ZipArchive } from 'archiver';
import { query, withTransaction } from '../db.js';
import { deleteUserFiles, fetchFile } from '../lib/cloudinary.js';
import { mailer } from '../lib/email.js';
import { HttpError } from '../lib/errors.js';
import { SECTION_NAMES, collectFiles, productIssues, productsCsv } from '../lib/export.js';
import { getSettings, notificationPrefs, saveSettings } from '../lib/settings.js';
import { createInvite, inviterName, reissueInvite } from '../lib/tokens.js';
import { publicUser, requireAuth, requireRole, requireStaff } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
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
import { BCRYPT_ROUNDS } from './auth.js';

const router = Router();
router.use(requireAuth, requireStaff);
const adminOnly = requireRole('admin');

const TOTAL_SECTIONS = SECTION_NAMES.length;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// ---------------------------------------------------------------- Clients

router.get('/clients', async (_req, res) => {
  const [clients, invites] = await Promise.all([
    query(CLIENT_SQL),
    query(
      `SELECT *, (expires_at <= now()) AS expired FROM invites
       WHERE kind = 'client' AND accepted_at IS NULL AND revoked_at IS NULL`,
    ),
  ]);
  res.json({
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

router.get('/clients/:id', async (req, res) => {
  const row = await loadClient(req.params.id);
  const { includeNoImages } = await getSettings('export');
  const { rows: requests } = await query(
    `SELECT c.*, u.full_name AS created_by_name FROM change_requests c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.submission_id = $1 ORDER BY c.created_at DESC`,
    [row.id],
  );
  res.json({
    client: clientSummary(row),
    submission: Object.fromEntries(Object.entries(SECTIONS).map(([key, { column }]) => [key, row[column]])),
    issues: productIssues(row),
    // Lets the page warn that products without images will be left out of the CSV.
    exportIncludesNoImages: includeNoImages,
    changeRequests: requests.map((c) => ({
      id: c.id,
      step: c.step,
      section: SECTION_NAMES[c.step],
      message: c.message,
      items: c.flagged_items,
      createdAt: c.created_at,
      createdBy: c.created_by_name,
      resolvedAt: c.resolved_at,
    })),
  });
});

router.post('/clients/:id/change-requests', adminOnly, validate(changeRequestSchema), async (req, res) => {
  const { step, message, items } = req.body;
  const row = await withTransaction(async (db) => {
    const client = await loadClient(req.params.id, db);
    await db.query(
      `INSERT INTO change_requests (submission_id, step, message, flagged_items, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [client.id, step, message, JSON.stringify(items), req.user.id],
    );
    await db.query(`UPDATE onboarding_submissions SET status = 'changes_requested' WHERE id = $1`, [client.id]);
    return client;
  });
  void mailer.sendChangesRequested({ to: row.email, contactName: row.full_name, sectionName: SECTION_NAMES[step], message });
  res.status(201).json({ ok: true });
});

const setArchived = (archived) => async (req, res) => {
  await loadClient(req.params.id);
  await query(`UPDATE users SET archived_at = ${archived ? 'now()' : 'NULL'} WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
};
router.post('/clients/:id/archive', adminOnly, setArchived(true));
router.post('/clients/:id/restore', adminOnly, setArchived(false));

router.delete('/clients/:id', adminOnly, validate(deleteClientSchema), async (req, res) => {
  const row = await loadClient(req.params.id);
  if (req.body.confirmName.trim() !== displayName(row)) {
    throw new HttpError(400, 'Type the business name exactly to confirm.');
  }
  await withTransaction(async (db) => {
    await db.query('DELETE FROM users WHERE id = $1', [row.user_id]); // cascades to the submission and its requests
    await db.query(`UPDATE invites SET revoked_at = now() WHERE email = $1 AND accepted_at IS NULL AND revoked_at IS NULL`, [row.email]);
  });
  await deleteUserFiles(row.user_id);
  res.status(204).end();
});

router.get('/clients/:id/products.csv', async (req, res) => {
  const row = await loadClient(req.params.id);
  const settings = await getSettings('export');
  const csv = productsCsv(row, settings, displayName(row));
  const filename = `${displayName(row).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'client'}-products.csv`;
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
  res.send(csv);
});

router.get('/clients/:id/files', async (req, res) => {
  const row = await loadClient(req.params.id);
  const entry = collectFiles(row).find((f) => f.file.publicId === req.query.publicId);
  if (!entry) throw new HttpError(404, 'That file is no longer part of this submission.');
  const { buffer, contentType } = await fetchFile(entry.file);
  const name = entry.path.split('/').pop();
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  });
  res.send(buffer);
});

router.get('/clients/:id/assets.zip', async (req, res) => {
  const row = await loadClient(req.params.id);
  const files = collectFiles(row);
  if (files.length === 0) throw new HttpError(404, 'This client has not uploaded any files yet.');

  const name = `${displayName(row).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'client'}-assets.zip`;
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name}"` });

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on('error', (err) => {
    console.error('Asset zip failed:', err);
    res.destroy(err);
  });
  archive.pipe(res);

  const failed = [];
  // One file at a time, so a large submission never holds every file in memory at once.
  for (const { path, file } of files) {
    try {
      const { buffer } = await fetchFile(file);
      archive.append(buffer, { name: path });
    } catch (err) {
      console.error(err.message);
      failed.push(path);
    }
  }
  if (failed.length) {
    archive.append(`These files could not be downloaded from Cloudinary:\n\n${failed.join('\n')}\n`, { name: 'MISSING-FILES.txt' });
  }
  await archive.finalize();
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

router.post('/invites', adminOnly, validate(clientInviteSchema), async (req, res) => {
  const { businessName, contactName, email, note } = req.body;
  let created;
  try {
    created = await withTransaction(async (db) => {
      await assertEmailFree(email, db);
      return createInvite(db, { kind: 'client', email, role: 'client', businessName, contactName, note: note || null, invitedBy: req.user.id });
    });
  } catch (err) {
    if (err.code === '23505') throw emailInUse();
    throw err;
  }
  await sendInviteEmail(created.invite, created.token);
  res.status(201).json({ invite: { id: created.invite.id, email } });
});

router.post('/invites/:id/resend', adminOnly, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) throw new HttpError(404, 'This invite no longer exists.');
  const reissued = await reissueInvite({ query }, req.params.id);
  if (!reissued) throw new HttpError(404, 'This invite no longer exists.');
  await sendInviteEmail(reissued.invite, reissued.token);
  res.json({ ok: true });
});

router.delete('/invites/:id', adminOnly, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) throw new HttpError(404, 'This invite no longer exists.');
  const { rowCount } = await query(
    'UPDATE invites SET revoked_at = now() WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL',
    [req.params.id],
  );
  if (!rowCount) throw new HttpError(404, 'This invite no longer exists.');
  res.status(204).end();
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

router.get('/leads', async (_req, res) => {
  const { rows } = await query('SELECT * FROM leads ORDER BY coalesce(call_date, created_at::date) DESC, created_at DESC');
  res.json({ leads: rows.map(leadOut) });
});

router.patch('/leads/:id', adminOnly, validate(leadStageSchema), async (req, res) => {
  if (!UUID_RE.test(req.params.id)) throw new HttpError(404, 'This lead no longer exists.');
  const { rows } = await query('UPDATE leads SET stage = $2 WHERE id = $1 RETURNING *', [req.params.id, req.body.stage]);
  if (!rows[0]) throw new HttpError(404, 'This lead no longer exists.');
  res.json({ lead: leadOut(rows[0]) });
});

// ---------------------------------------------------------------- Team

router.get('/team', async (_req, res) => {
  const [members, invites] = await Promise.all([
    query(`SELECT id, email, full_name, role FROM users WHERE role IN ('admin', 'viewer') ORDER BY created_at`),
    query(
      `SELECT id, email, role, (expires_at <= now()) AS expired FROM invites
       WHERE kind = 'staff' AND accepted_at IS NULL AND revoked_at IS NULL ORDER BY created_at`,
    ),
  ]);
  res.json({
    members: members.rows.map((m) => ({ id: m.id, kind: 'member', email: m.email, name: m.full_name ?? '', role: m.role })),
    invites: invites.rows.map((i) => ({ id: i.id, kind: 'invite', email: i.email, name: '', role: i.role, expired: i.expired })),
  });
});

router.post('/team/invites', adminOnly, validate(staffInviteSchema), async (req, res) => {
  const { email, role } = req.body;
  let created;
  try {
    created = await withTransaction(async (db) => {
      await assertEmailFree(email, db);
      return createInvite(db, { kind: 'staff', email, role, invitedBy: req.user.id });
    });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'That person already has access.', { fields: { email: 'That person already has access.' } });
    throw err;
  }
  await sendInviteEmail(created.invite, created.token);
  res.status(201).json({ invite: { id: created.invite.id, email, role } });
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

router.patch('/team/:id', adminOnly, validate(roleSchema), async (req, res) => {
  await withTransaction(async (db) => {
    const member = await loadMember(db, req.params.id, req.user.id);
    if (member.role === 'admin' && req.body.role !== 'admin') await assertAnotherAdmin(db, member.id);
    await db.query('UPDATE users SET role = $2 WHERE id = $1', [member.id, req.body.role]);
  });
  res.json({ ok: true });
});

router.delete('/team/:id', adminOnly, async (req, res) => {
  await withTransaction(async (db) => {
    const member = await loadMember(db, req.params.id, req.user.id);
    if (member.role === 'admin') await assertAnotherAdmin(db, member.id);
    await db.query('DELETE FROM users WHERE id = $1', [member.id]);
  });
  res.status(204).end();
});

// ---------------------------------------------------------------- Settings

router.get('/settings', adminOnly, async (_req, res) => {
  const [onboarding, exportSettings] = await Promise.all([getSettings('onboarding'), getSettings('export')]);
  res.json({ settings: { onboarding, export: exportSettings } });
});

router.put('/settings/onboarding', adminOnly, validate(onboardingSettingsSchema), async (req, res) => {
  res.json({ settings: await saveSettings('onboarding', req.body, req.user.id) });
});

router.put('/settings/export', adminOnly, validate(exportSettingsSchema), async (req, res) => {
  res.json({ settings: await saveSettings('export', req.body, req.user.id) });
});

// ---------------------------------------------------------------- The signed-in staff member

router.put('/me/account', validate(accountSchema), async (req, res) => {
  const { fullName, email, currentPassword, newPassword } = req.body;
  const changingEmail = email !== req.user.email;

  if (changingEmail || newPassword) {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = currentPassword && (await bcrypt.compare(currentPassword, rows[0].password_hash));
    if (!ok) {
      const message = currentPassword
        ? "That password isn't right."
        : changingEmail
          ? 'Enter your current password to change your email.'
          : 'Enter your current password.';
      throw new HttpError(400, message, { fields: { currentPassword: message } });
    }
  }

  const passwordHash = newPassword ? await bcrypt.hash(newPassword, BCRYPT_ROUNDS) : null;
  try {
    const { rows } = await query(
      `UPDATE users SET full_name = $2, email = $3, password_hash = coalesce($4, password_hash)
       WHERE id = $1 RETURNING id, email, role, business_name, full_name, email_verified_at`,
      [req.user.id, fullName, email, passwordHash],
    );
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      throw new HttpError(409, 'Another account already uses that email.', { fields: { email: 'Another account already uses that email.' } });
    }
    throw err;
  }
});

router.get('/me/notifications', async (req, res) => {
  res.json({ notifications: notificationPrefs(req.user) });
});

router.put('/me/notifications', validate(notificationsSchema), async (req, res) => {
  const { rows } = await query(
    'UPDATE users SET notification_prefs = $2::jsonb WHERE id = $1 RETURNING email, notification_prefs',
    [req.user.id, JSON.stringify(req.body)],
  );
  res.json({ notifications: notificationPrefs(rows[0]) });
});

export default router;
