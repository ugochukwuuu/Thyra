import { query } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { readSession, SESSION_COOKIE } from '../lib/session.js';

export const STAFF_ROLES = ['admin', 'viewer'];
export const isStaff = (user) => STAFF_ROLES.includes(user?.role);

export const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  businessName: row.business_name,
  fullName: row.full_name,
  emailVerified: Boolean(row.email_verified_at),
});

const USER_COLUMNS = 'id, email, role, business_name, full_name, email_verified_at, archived_at, notification_prefs';

/** Loads the user behind the session cookie. Re-reads the DB so deleted users and role changes apply at once. */
export async function requireAuth(req, _res, next) {
  const userId = readSession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return next(new HttpError(401, 'Please log in to continue.'));
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) return next(new HttpError(401, 'Please log in to continue.'));
  req.user = rows[0];
  next();
}

/** Allows any of the given roles. */
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have access to this.'));

export const requireStaff = requireRole(...STAFF_ROLES);
