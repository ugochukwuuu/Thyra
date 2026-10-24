import { config } from './config.js';
import { query } from './db.js';
import { HttpError } from './errors.js';
import { auth } from './supabase.js';

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

/** The Supabase user id behind the request's access token, or null. */
function userIdFrom(c) {
  const token = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '')?.[1];
  if (!token) return null;
  return auth.userIdFromToken(token);
}

/** Loads the signed-in user. Re-reads the database so deleted users and role changes apply at once. */
export async function requireAuth(c, next) {
  const userId = await userIdFrom(c);
  if (!userId) throw new HttpError(401, 'Please log in to continue.');
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
  if (!rows[0]) throw new HttpError(401, 'Please log in to continue.');
  c.set('user', rows[0]);
  await next();
}

/** Allows any of the given roles. */
export const requireRole =
  (...roles) =>
  async (c, next) => {
    if (!roles.includes(c.get('user').role)) throw new HttpError(403, 'You do not have access to this.');
    await next();
  };

export const requireStaff = requireRole(...STAFF_ROLES);

/**
 * Parses the JSON body with a zod schema and returns the parsed value.
 * Errors become a 400 with the first message, plus every field's message.
 */
export async function parseBody(c, schema) {
  let body = {};
  if (c.req.header('Content-Type')?.includes('application/json')) {
    try {
      body = await c.req.json();
    } catch {
      throw new HttpError(400, 'The request body is not valid JSON.');
    }
  }
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new HttpError(400, Object.values(fields)[0], { fields });
}

/**
 * Keeps work going after the response is sent (emails, file clean-up). Edge Functions stop
 * when the response ends unless the work is handed to EdgeRuntime.waitUntil.
 */
export function background(promise) {
  const safe = Promise.resolve(promise).catch((err) => console.error('Background task failed:', err));
  globalThis.EdgeRuntime?.waitUntil?.(safe);
  return safe;
}

/**
 * Allows `max` requests per IP address every `windowMinutes` for the route group `name`.
 * Counted in the database, because each Edge Function instance is short-lived.
 */
export const limiter = (name, windowMinutes, max) => async (c, next) => {
  if (!config.isTest) {
    const ip = (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const { rows } = await query(
      `INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.window_start < now() - make_interval(mins => $2) THEN 1 ELSE rate_limits.hits + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - make_interval(mins => $2) THEN now() ELSE rate_limits.window_start END
       RETURNING hits`,
      [`${name}:${ip}`, windowMinutes],
    );
    if (rows[0].hits > max) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
  }
  await next();
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
