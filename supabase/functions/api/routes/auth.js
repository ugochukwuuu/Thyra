import { Hono } from 'hono';
import { query, withTransaction } from '../lib/db.js';
import { mailer } from '../lib/email.js';
import { HttpError } from '../lib/errors.js';
import { background, isStaff, limiter, parseBody, publicUser, requireAuth, requireRole } from '../lib/http.js';
import { notifyStaff } from '../lib/notify.js';
import { config } from '../lib/config.js';
import { auth } from '../lib/supabase.js';
import { findInviteByToken, generateResetToken, hashToken, sendVerification } from '../lib/tokens.js';
import {
  forgotPasswordSchema,
  joinTeamSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validation/auth.js';

// Signing in and out happens in the browser through Supabase Auth. These routes cover the rest:
// creating accounts (so invites and the app's own user rows stay in step), password resets and email confirmation.

// Reset links: staff get an hour (per the admin design), clients 15 minutes (per the client design).
const RESET_MINUTES = { staff: 60, client: config.resetTokenMinutes };

const RETURNING = 'RETURNING id, email, role, business_name, full_name, email_verified_at';

const emailTaken = () =>
  new HttpError(409, 'An account with this email already exists.', {
    fields: { email: 'An account with this email already exists.' },
  });

/**
 * Creates the Supabase Auth account, then the app's rows in `addRows`. If the rows fail,
 * the Auth account is removed again so the email is free to try once more.
 */
async function createAccount(email, password, addRows, taken) {
  const id = await auth.createUser(email, password);
  if (!id) throw taken();
  try {
    return await withTransaction((db) => addRows(db, id));
  } catch (err) {
    await auth.deleteUser(id).catch((e) => console.error('Could not remove a half-created account:', e));
    if (err.code === '23505') throw taken();
    throw err;
  }
}

const router = new Hono();

/** Public: what the sign-up and join-team pages show for an invite link. */
router.get('/invites/:token', async (c) => {
  const invite = await findInviteByToken(c.req.param('token'));
  if (!invite) throw new HttpError(404, 'This invite link is no longer valid.');
  return c.json({
    invite: {
      kind: invite.kind,
      email: invite.email,
      role: invite.role,
      businessName: invite.business_name,
      contactName: invite.contact_name,
      inviterName: invite.inviter_name,
      expired: invite.expired,
    },
  });
});

/** Creates a client account. The browser signs in with the same email and password afterwards. */
router.post('/register', limiter('register', 15, 20), async (c) => {
  const { businessName, password, inviteToken, ...body } = await parseBody(c, registerSchema);
  let { email } = body;

  let invite = null;
  if (inviteToken) {
    invite = await findInviteByToken(inviteToken);
    if (!invite || invite.kind !== 'client') throw new HttpError(400, 'This invite link is no longer valid.');
    if (invite.expired) throw new HttpError(400, 'This invite has expired. Ask the Thyra team to send a new one.');
    // The invite proves the person owns this inbox, so the account uses it as is and starts verified.
    email = invite.email;
  }

  const user = await createAccount(
    email,
    password,
    async (db, id) => {
      const { rows } = await db.query(
        `INSERT INTO users (id, email, role, business_name, full_name, email_verified_at)
         VALUES ($1, $2, 'client', $3, $4, $5) ${RETURNING}`,
        [id, email, businessName, invite?.contact_name ?? null, invite ? new Date() : null],
      );
      await db.query('INSERT INTO onboarding_submissions (user_id) VALUES ($1)', [id]);
      // Any open client invite for this email is now used up, however the person signed up.
      await db.query(
        `UPDATE invites SET accepted_at = now()
         WHERE email = $1 AND kind = 'client' AND accepted_at IS NULL AND revoked_at IS NULL`,
        [email],
      );
      return rows[0];
    },
    emailTaken,
  );

  if (!user.email_verified_at) await sendVerification(user);
  background(
    notifyStaff('signup', {
      subject: `New client: ${user.business_name}`,
      heading: `${user.business_name} created an account`,
      paragraphs: [`${user.email} just signed up and can start their onboarding.`],
      path: `/admin/submissions/${user.id}`,
    }),
  );
  return c.json({ user: publicUser(user) }, 201);
});

router.get('/me', requireAuth, (c) => c.json({ user: publicUser(c.get('user')) }));

// Always answers the same way, so this can't be used to find out who has an account.
router.post('/forgot-password', limiter('forgot', 60, 5), async (c) => {
  const { email } = await parseBody(c, forgotPasswordSchema);
  const { rows } = await query('SELECT id, email, role FROM users WHERE email = $1', [email]);
  const user = rows[0];

  if (user) {
    const staff = isStaff(user);
    const minutes = staff ? RESET_MINUTES.staff : RESET_MINUTES.client;
    const token = generateResetToken();
    await withTransaction(async (db) => {
      // Only the newest link should work.
      await db.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
      await db.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3))`,
        [user.id, hashToken(token), minutes],
      );
    });
    // Sent after the response, so real accounts answer as fast as unknown emails.
    background(mailer.sendPasswordReset({ to: user.email, token, staff, minutes }));
  }

  return c.json({ message: 'If that email has an account, a reset link is on its way.' });
});

router.post('/reset-password', limiter('reset', 15, 10), async (c) => {
  const { token, password } = await parseBody(c, resetPasswordSchema);

  const userId = await withTransaction(async (db) => {
    // Single statement claims the token, so two concurrent requests can't both use it.
    const { rows } = await db.query(
      `UPDATE password_resets SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [hashToken(token)],
    );
    if (!rows[0]) throw new HttpError(400, 'This reset link has expired or was already used.');
    await db.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [rows[0].user_id]);
    return rows[0].user_id;
  });

  await auth.updateUser(userId, { password });
  return c.json({ message: 'Password updated. You can log in now.' });
});

/** A staff member accepting their invite from Settings > Team. The browser signs in afterwards. */
router.post('/join-team', limiter('join', 15, 10), async (c) => {
  const { token, fullName, password } = await parseBody(c, joinTeamSchema);
  const invite = await findInviteByToken(token);
  if (!invite || invite.kind !== 'staff') throw new HttpError(400, 'This invite link is no longer valid.');
  if (invite.expired) throw new HttpError(400, 'This invite has expired.');

  const user = await createAccount(
    invite.email,
    password,
    async (db, id) => {
      const { rows } = await db.query(
        `INSERT INTO users (id, email, role, full_name, email_verified_at)
         VALUES ($1, $2, $3, $4, now()) ${RETURNING}`,
        [id, invite.email, invite.role, fullName],
      );
      const accepted = await db.query(
        'UPDATE invites SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL',
        [invite.id],
      );
      if (!accepted.rowCount) throw new HttpError(400, 'This invite link is no longer valid.');
      return rows[0];
    },
    () => new HttpError(409, 'That email already has an account. Log in instead.'),
  );

  return c.json({ user: publicUser(user) }, 201);
});

/** Opened from the confirmation email. Works whether or not the person is logged in. */
router.post('/verify-email', limiter('verify', 15, 20), async (c) => {
  const { token } = await parseBody(c, verifyEmailSchema);
  const { rows } = await query(
    `UPDATE email_verifications SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [hashToken(token)],
  );
  if (!rows[0]) throw new HttpError(400, 'This confirmation link has expired or was already used.');
  await query('UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1', [rows[0].user_id]);
  return c.json({ message: 'Email confirmed.' });
});

router.post('/resend-verification', limiter('resend', 60, 5), requireAuth, requireRole('client'), async (c) => {
  const user = c.get('user');
  if (!user.email_verified_at) await sendVerification(user);
  return c.json({ message: 'A new confirmation link is on its way.' });
});

export default router;
