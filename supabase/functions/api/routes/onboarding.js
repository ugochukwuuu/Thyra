import { Hono } from 'hono';
import { uploadSignature } from '../lib/cloudinary.js';
import { query, withTransaction } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { background, parseBody, requireAuth, requireRole } from '../lib/http.js';
import { notifyStaff } from '../lib/notify.js';
import { getSettings } from '../lib/settings.js';
import { SECTIONS, draftSchema, findSubmissionProblems } from '../validation/onboarding.js';

const router = new Hono();
router.use(requireAuth, requireRole('client'));

// A client can edit while filling the form in, and again when the team asks for changes.
const EDITABLE = ['in_progress', 'changes_requested'];
const EDITABLE_SQL = `status IN ('in_progress', 'changes_requested')`;

const serialize = (row, changeRequests = []) => ({
  id: row.id,
  status: row.status,
  // Open requests from the Thyra team; the client sees each one at the top of its section.
  changeRequests: changeRequests.map((c) => ({
    id: c.id,
    step: c.step,
    message: c.message,
    flaggedItems: c.flagged_items,
    createdAt: c.created_at,
  })),
  // The furthest wizard step reached (0-9); a returning client resumes there.
  currentStep: row.current_step,
  ...Object.fromEntries(Object.entries(SECTIONS).map(([key, { column }]) => [key, row[column]])),
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
});

async function findSubmission(userId) {
  const { rows } = await query('SELECT * FROM onboarding_submissions WHERE user_id = $1', [userId]);
  if (!rows[0]) throw new HttpError(404, 'No onboarding submission found for this account.');
  return rows[0];
}

async function openChangeRequests(submissionId) {
  const { rows } = await query(
    'SELECT * FROM change_requests WHERE submission_id = $1 AND resolved_at IS NULL ORDER BY created_at',
    [submissionId],
  );
  return rows;
}

const alreadySubmitted = () =>
  new HttpError(409, 'This submission has already been confirmed and can no longer be edited.');

router.get('/', async (c) => {
  const row = await findSubmission(c.get('user').id);
  return c.json({ submission: serialize(row, await openChangeRequests(row.id)) });
});

/** Choices the admin controls in Settings > Onboarding form. */
router.get('/options', async (c) => {
  const s = await getSettings('onboarding');
  return c.json({ options: { socialPlatforms: s.socialPlatforms, voiceInput: s.voiceInput } });
});

// Autosave. Sections that are sent replace the stored section whole; the rest are untouched.
router.put('/', async (c) => {
  const user = c.get('user');
  const body = await parseBody(c, draftSchema(user.id));
  const sets = [];
  const params = [user.id];
  for (const [key, { column }] of Object.entries(SECTIONS)) {
    if (body[key] === undefined) continue;
    params.push(JSON.stringify(body[key]));
    sets.push(`${column} = $${params.length}::jsonb`);
  }
  if (body.currentStep !== undefined) {
    params.push(body.currentStep);
    sets.push(`current_step = $${params.length}`);
  }

  if (sets.length === 0) {
    const row = await findSubmission(user.id);
    return c.json({ submission: serialize(row, await openChangeRequests(row.id)) });
  }

  const { rows } = await query(
    `UPDATE onboarding_submissions SET ${sets.join(', ')}
     WHERE user_id = $1 AND ${EDITABLE_SQL}
     RETURNING *`,
    params,
  );
  if (!rows[0]) {
    await findSubmission(user.id); // 404 if the row is missing entirely
    throw alreadySubmitted();
  }
  return c.json({ submission: serialize(rows[0], await openChangeRequests(rows[0].id)) });
});

router.post('/submit', async (c) => {
  const user = c.get('user');
  if (!user.email_verified_at) {
    throw new HttpError(403, `Confirm your email before you submit. We sent a link to ${user.email}.`, {
      extra: { code: 'email_unverified' },
    });
  }
  let justSubmitted = false;
  const row = await withTransaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM onboarding_submissions WHERE user_id = $1 FOR UPDATE', [user.id]);
    const current = rows[0];
    if (!current) throw new HttpError(404, 'No onboarding submission found for this account.');
    if (current.status === 'submitted') return current; // confirming twice is harmless

    const problems = findSubmissionProblems(current);
    if (problems.length) {
      throw new HttpError(422, 'Some details still need attention before you can confirm.', { extra: { problems } });
    }
    const updated = await db.query(
      `UPDATE onboarding_submissions SET status = 'submitted', submitted_at = now() WHERE id = $1 RETURNING *`,
      [current.id],
    );
    // Confirming again is the client's answer to any open change requests.
    await db.query('UPDATE change_requests SET resolved_at = now() WHERE submission_id = $1 AND resolved_at IS NULL', [current.id]);
    justSubmitted = true;
    return updated.rows[0];
  });

  if (justSubmitted) {
    const name = user.business_name || user.email;
    background(
      notifyStaff('submitted', {
        subject: `${name} submitted their onboarding`,
        heading: `${name} confirmed their details`,
        paragraphs: ['Their onboarding is ready to review and export.'],
        path: `/admin/submissions/${user.id}`,
      }),
    );
  }
  return c.json({ submission: serialize(row) });
});

/**
 * A signature that lets the browser upload files straight to Cloudinary, into this client's folder.
 * The browser checks each file's type and size first; the saved form only accepts files from that folder.
 */
router.post('/files/signature', async (c) => {
  const row = await findSubmission(c.get('user').id);
  if (!EDITABLE.includes(row.status)) throw alreadySubmitted();
  return c.json({ upload: uploadSignature(c.get('user').id) });
});

export default router;
