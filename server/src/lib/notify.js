import { query } from '../db.js';
import { mailer } from './email.js';
import { notificationPrefs } from './settings.js';

/**
 * Emails every staff member who turned on notification `kind` ('signup' | 'submitted' | 'stalled' | 'weekly').
 * Fire and forget: callers do not wait on it, and failures are only logged.
 */
export async function notifyStaff(kind, message) {
  try {
    const { rows } = await query(
      `SELECT id, email, notification_prefs FROM users WHERE role IN ('admin', 'viewer')`,
    );
    const recipients = [...new Set(rows.map(notificationPrefs).filter((p) => p[kind]).map((p) => p.to))];
    await Promise.all(recipients.map((to) => mailer.sendStaffNotification({ to, ...message })));
  } catch (err) {
    console.error(`Failed to send "${kind}" notifications:`, err);
  }
}
