import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { mailer } from '../lib/email.js';
import { HttpError } from '../lib/errors.js';
import { notifyStaff } from '../lib/notify.js';
import { clearSession, generateResetToken, hashToken, issueSession } from '../lib/session.js';
import { findInviteByToken, sendVerification } from '../lib/tokens.js';
import { isStaff, publicUser, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  joinTeamSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validation/auth.js';

export const BCRYPT_ROUNDS = 12;
// Reset links: staff get an hour (per the admin design), clients 15 minutes (per the client design).
const RESET_MINUTES = { staff: 60, client: config.resetTokenMinutes };

// Compared against when the email is unknown, so "no such user" costs the same as "wrong password".
const dummyHash = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const RETURNING = 'RETURNING id, email, role, business_name, full_name, email_verified_at';

export const limiter = (windowMinutes, max) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.')),
  });

const emailTaken = () =>
  new HttpError(409, 'An account with this email already exists.', {
    fields: { email: 'An account with this email already exists.' },
  });

const router = Router();

/** Public: what the sign-up and join-team pages show for an invite link. */
router.get('/invites/:token', async (req, res) => {
  const invite = await findInviteByToken(req.params.token);
  if (!invite) throw new HttpError(404, 'This invite link is no longer valid.');
  res.json({
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

router.post('/register', limiter(15, 20), validate(registerSchema), async (req, res) => {
  const { businessName, password, inviteToken } = req.body;
  let { email } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await withTransaction(async (db) => {
      let invite = null;
      if (inviteToken) {
        invite = await findInviteByToken(inviteToken, db);
        if (!invite || invite.kind !== 'client') throw new HttpError(400, 'This invite link is no longer valid.');
        if (invite.expired) throw new HttpError(400, 'This invite has expired. Ask the Thyra team to send a new one.');
        // The invite proves the person owns this inbox, so the account uses it as is and starts verified.
        email = invite.email;
      }
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, role, business_name, full_name, email_verified_at)
         VALUES ($1, $2, 'client', $3, $4, $5) ${RETURNING}`,
        [email, passwordHash, businessName, invite?.contact_name ?? null, invite ? new Date() : null],
      );
      await db.query('INSERT INTO onboarding_submissions (user_id) VALUES ($1)', [rows[0].id]);
      // Any open client invite for this email is now used up, however the person signed up.
      await db.query(
        `UPDATE invites SET accepted_at = now()
         WHERE email = $1 AND kind = 'client' AND accepted_at IS NULL AND revoked_at IS NULL`,
        [email],
      );
      return rows[0];
    });
  } catch (err) {
    if (err.code === '23505') throw emailTaken();
    throw err;
  }

  if (!user.email_verified_at) await sendVerification(user);
  void notifyStaff('signup', {
    subject: `New client: ${user.business_name}`,
    heading: `${user.business_name} created an account`,
    paragraphs: [`${user.email} just signed up and can start their onboarding.`],
    path: `/admin/submissions/${user.id}`,
  });

  issueSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', limiter(15, 20), validate(loginSchema), async (req, res) => {
  const { email, password, scope } = req.body;
  const { rows } = await query(
    'SELECT id, email, role, business_name, full_name, email_verified_at, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : dummyHash);
  // The staff login gives clients the same answer as a wrong password, so it reveals nothing.
  if (!user || !ok || (scope === 'staff' && !isStaff(user))) {
    throw new HttpError(401, "That email and password don't match.");
  }

  issueSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Always answers the same way, so this can't be used to find out who has an account.
router.post('/forgot-password', limiter(60, 5), validate(forgotPasswordSchema), async (req, res) => {
  const { rows } = await query('SELECT id, email, role FROM users WHERE email = $1', [req.body.email]);
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
    // Not awaited: waiting on the email provider would make this response slower for real accounts.
    void mailer.sendPasswordReset({ to: user.email, token, staff, minutes });
  }

  res.json({ message: 'If that email has an account, a reset link is on its way.' });
});

router.post('/reset-password', limiter(15, 10), validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await withTransaction(async (db) => {
    // Single statement claims the token, so two concurrent requests can't both use it.
    const { rows } = await db.query(
      `UPDATE password_resets SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [hashToken(token)],
    );
    if (!rows[0]) throw new HttpError(400, 'This reset link has expired or was already used.');

    const userId = rows[0].user_id;
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await db.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
  });

  res.json({ message: 'Password updated. You can log in now.' });
});

/** A staff member accepting their invite from Settings > Team. */
router.post('/join-team', limiter(15, 10), validate(joinTeamSchema), async (req, res) => {
  const { token, fullName, password } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await withTransaction(async (db) => {
      const invite = await findInviteByToken(token, db);
      if (!invite || invite.kind !== 'staff') throw new HttpError(400, 'This invite link is no longer valid.');
      if (invite.expired) throw new HttpError(400, 'This invite has expired.');
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, role, full_name, email_verified_at)
         VALUES ($1, $2, $3, $4, now()) ${RETURNING}`,
        [invite.email, passwordHash, invite.role, fullName],
      );
      await db.query('UPDATE invites SET accepted_at = now() WHERE id = $1', [invite.id]);
      return rows[0];
    });
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'That email already has an account. Log in instead.');
    throw err;
  }

  issueSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

/** Opened from the confirmation email. Works whether or not the person is logged in. */
router.post('/verify-email', limiter(15, 20), validate(verifyEmailSchema), async (req, res) => {
  const { rows } = await query(
    `UPDATE email_verifications SET used_at = now()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [hashToken(req.body.token)],
  );
  if (!rows[0]) throw new HttpError(400, 'This confirmation link has expired or was already used.');
  await query('UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1', [rows[0].user_id]);
  res.json({ message: 'Email confirmed.' });
});

router.post('/resend-verification', limiter(60, 5), requireAuth, requireRole('client'), async (req, res) => {
  if (!req.user.email_verified_at) await sendVerification(req.user);
  res.json({ message: 'A new confirmation link is on its way.' });
});

export default router;
