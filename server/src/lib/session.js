import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const SESSION_COOKIE = 'thyra_session';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
};

export function issueSession(res, user) {
  const token = jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: `${config.sessionDays}d`,
    algorithm: 'HS256',
  });
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Returns the user id from a session token, or null if it is missing/invalid/expired. */
export function readSession(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export const generateResetToken = () => crypto.randomBytes(32).toString('hex');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
