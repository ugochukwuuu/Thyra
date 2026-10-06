import { pool, query } from '../db.js';
import { notifyStaff } from './notify.js';
import { getSettings, saveSettings } from './settings.js';

const HOUR = 60 * 60 * 1000;
const JOB_LOCK = 727275; // advisory lock id, so only one instance runs the jobs at a time
const STALL_DAYS = 7;
const TIMEZONE = 'Africa/Lagos';

/** Clients who have not touched their onboarding for 7 days get one email to staff per stall. */
export async function notifyStalled(db = { query }) {
  const { rows } = await db.query(
    `SELECT u.id, u.email, coalesce(s.business_info->>'name', u.business_name) AS name, s.updated_at
     FROM onboarding_submissions s JOIN users u ON u.id = s.user_id
     WHERE u.role = 'client' AND u.archived_at IS NULL
       AND s.status IN ('in_progress', 'changes_requested')
       AND s.updated_at < now() - make_interval(days => $1)
       AND (u.stalled_notified_at IS NULL OR u.stalled_notified_at < s.updated_at)`,
    [STALL_DAYS],
  );
  for (const r of rows) {
    await db.query('UPDATE users SET stalled_notified_at = now() WHERE id = $1', [r.id]);
    await notifyStaff('stalled', {
      subject: `${r.name || r.email} hasn't continued their onboarding`,
      heading: `${r.name || r.email} has stalled`,
      paragraphs: [`They haven't made any changes for ${STALL_DAYS} days. A quick nudge might help (${r.email}).`],
      path: `/admin/submissions/${r.id}`,
    });
  }
  return rows.length;
}

/** The date of the most recent Monday in Lagos, and whether it is past 8am there. */
function lagosMonday(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { isMondayMorning: parts.weekday === 'Mon' && Number(parts.hour) >= 8, date: `${parts.year}-${parts.month}-${parts.day}` };
}

/** A Monday email with the past week's new clients and submissions. Sent once per week. */
export async function sendWeeklySummary(now = new Date(), db = { query }) {
  const { isMondayMorning, date } = lagosMonday(now);
  if (!isMondayMorning) return false;
  const jobs = await getSettings('jobs', db);
  if (jobs.weeklySummarySentFor === date) return false;

  const { rows } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM users WHERE role = 'client' AND created_at > now() - interval '7 days') AS signups,
       (SELECT count(*)::int FROM onboarding_submissions WHERE status = 'submitted' AND submitted_at > now() - interval '7 days') AS submissions,
       (SELECT coalesce(string_agg(coalesce(s.business_info->>'name', u.business_name), ', '), '')
          FROM onboarding_submissions s JOIN users u ON u.id = s.user_id
          WHERE s.status = 'submitted' AND s.submitted_at > now() - interval '7 days') AS submitted_names`,
  );
  const r = rows[0];
  await saveSettings('jobs', { ...jobs, weeklySummarySentFor: date }, null, db);
  await notifyStaff('weekly', {
    subject: `Thyra weekly summary: ${r.signups} new, ${r.submissions} submitted`,
    heading: 'Your week in onboarding',
    paragraphs: [
      `New client accounts this week: ${r.signups}.`,
      `Onboardings submitted this week: ${r.submissions}.${r.submitted_names ? `\n${r.submitted_names}` : ''}`,
    ],
    path: '/admin/submissions',
  });
  return true;
}

async function runJobs() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [JOB_LOCK]);
    if (!rows[0].ok) return;
    try {
      await notifyStalled(client);
      await sendWeeklySummary(new Date(), client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [JOB_LOCK]);
    }
  } catch (err) {
    console.error('Scheduled jobs failed:', err);
  } finally {
    client.release();
  }
}

/** Checks hourly. Started by the server, never by tests. */
export function startJobs() {
  const first = setTimeout(runJobs, 60 * 1000);
  const timer = setInterval(runJobs, HOUR);
  first.unref();
  timer.unref();
}
