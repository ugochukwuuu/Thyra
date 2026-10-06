import { query } from '../db.js';
import { mailer } from './email.js';
import { generateResetToken, hashToken } from './session.js';
import { getSettings } from './settings.js';

export const INVITE_DAYS = 7;

/**
 * Creates an invite and returns it with the raw token (which is only ever emailed, never stored).
 * Throws the database's unique violation (23505) if this email already has an open invite.
 */
export async function createInvite(db, { kind, email, role, businessName = null, contactName = null, note = null, invitedBy }) {
  const token = generateResetToken();
  const { rows } = await db.query(
    `INSERT INTO invites (kind, email, role, business_name, contact_name, note, token_hash, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(days => $9))
     RETURNING *`,
    [kind, email, role, businessName, contactName, note, hashToken(token), invitedBy, INVITE_DAYS],
  );
  return { invite: rows[0], token };
}

/** Gives an open invite a fresh token and expiry. The old link stops working. */
export async function reissueInvite(db, inviteId) {
  const token = generateResetToken();
  const { rows } = await db.query(
    `UPDATE invites SET token_hash = $2, expires_at = now() + make_interval(days => $3)
     WHERE id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
     RETURNING *`,
    [inviteId, hashToken(token), INVITE_DAYS],
  );
  return rows[0] ? { invite: rows[0], token } : null;
}

/** An unaccepted, unrevoked invite for this token (expired or not), with the inviter's name. */
export async function findInviteByToken(token, db = { query }) {
  const { rows } = await db.query(
    `SELECT i.*, (i.expires_at <= now()) AS expired, u.full_name AS inviter_name
     FROM invites i LEFT JOIN users u ON u.id = i.invited_by
     WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL`,
    [hashToken(String(token))],
  );
  return rows[0] ?? null;
}

export async function inviterName(userId) {
  if (!userId) return null;
  const { rows } = await query('SELECT full_name, email FROM users WHERE id = $1', [userId]);
  return rows[0]?.full_name || rows[0]?.email || null;
}

/** Sends a fresh email verification link. Earlier links stop working. */
export async function sendVerification(user) {
  const { verificationHours } = await getSettings('onboarding');
  const token = generateResetToken();
  await query('UPDATE email_verifications SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await query(
    `INSERT INTO email_verifications (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [user.id, hashToken(token), verificationHours],
  );
  void mailer.sendEmailVerification({ to: user.email, token, hours: verificationHours });
}
