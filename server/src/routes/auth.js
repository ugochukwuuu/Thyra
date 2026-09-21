import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { mailer } from '../lib/email.js';
import { HttpError } from '../lib/errors.js';
import { clearSession, generateResetToken, hashToken, issueSession } from '../lib/session.js';
import { publicUser, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validation/auth.js';

const BCRYPT_ROUNDS = 12;

// Compared against when the email is unknown, so "no such user" costs the same as "wrong password".
const dummyHash = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const limiter = (windowMinutes, max) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, _res, next) =>
      next(new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.')),
  });

const router = Router();

router.post('/register', limiter(15, 20), validate(registerSchema), async (req, res) => {
  const { businessName, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user;
  try {
    user = await withTransaction(async (db) => {
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, role, business_name)
         VALUES ($1, $2, 'client', $3)
         RETURNING id, email, role, business_name`,
        [email, passwordHash, businessName],
      );
      await db.query('INSERT INTO onboarding_submissions (user_id) VALUES ($1)', [rows[0].id]);
      return rows[0];
    });
  } catch (err) {
    if (err.code === '23505') {
      throw new HttpError(409, 'An account with this email already exists.', {
        fields: { email: 'An account with this email already exists.' },
      });
    }
    throw err;
  }

  issueSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', limiter(15, 20), validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query(
    'SELECT id, email, role, business_name, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : dummyHash);
  if (!user || !ok) throw new HttpError(401, "That email and password don't match.");

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
  const { rows } = await query('SELECT id, email FROM users WHERE email = $1', [req.body.email]);
  const user = rows[0];

  if (user) {
    const token = generateResetToken();
    await withTransaction(async (db) => {
      // Only the newest link should work.
      await db.query(
        'UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
        [user.id],
      );
      await db.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3))`,
        [user.id, hashToken(token), config.resetTokenMinutes],
      );
    });
    // Not awaited: waiting on the email provider would make this response slower for real accounts.
    void mailer.sendPasswordReset(user.email, token);
  }

  res.json({ message: `If that email has an account, a reset link is on its way. It expires in ${config.resetTokenMinutes} minutes.` });
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
    await db.query(
      'UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [userId],
    );
  });

  res.json({ message: 'Password updated. You can log in now.' });
});

export default router;
