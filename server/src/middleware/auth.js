import { query } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { readSession, SESSION_COOKIE } from '../lib/session.js';

export const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  businessName: row.business_name,
});

/** Loads the user behind the session cookie. Re-reads the DB so deleted users and role changes apply at once. */
export async function requireAuth(req, _res, next) {
  const userId = readSession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return next(new HttpError(401, 'Please log in to continue.'));
  const { rows } = await query(
    'SELECT id, email, role, business_name FROM users WHERE id = $1',
    [userId],
  );
  if (!rows[0]) return next(new HttpError(401, 'Please log in to continue.'));
  req.user = rows[0];
  next();
}

export const requireRole = (role) => (req, _res, next) =>
  req.user.role === role ? next() : next(new HttpError(403, 'You do not have access to this.'));
