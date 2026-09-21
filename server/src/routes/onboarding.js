import { Router } from 'express';
import multer from 'multer';
import { query, withTransaction } from '../db.js';
import { uploadFile } from '../lib/cloudinary.js';
import { HttpError } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { SECTIONS, draftSchema, findSubmissionProblems } from '../validation/onboarding.js';

const router = Router();
router.use(requireAuth, requireRole('client'));

const serialize = (row) => ({
  id: row.id,
  status: row.status,
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

const alreadySubmitted = () =>
  new HttpError(409, 'This submission has already been confirmed and can no longer be edited.');

router.get('/', async (req, res) => {
  res.json({ submission: serialize(await findSubmission(req.user.id)) });
});

// Autosave. Sections that are sent replace the stored section whole; the rest are untouched.
router.put('/', validate((req) => draftSchema(req.user.id)), async (req, res) => {
  const sets = [];
  const params = [req.user.id];
  for (const [key, { column }] of Object.entries(SECTIONS)) {
    if (req.body[key] === undefined) continue;
    params.push(JSON.stringify(req.body[key]));
    sets.push(`${column} = $${params.length}::jsonb`);
  }
  if (req.body.currentStep !== undefined) {
    params.push(req.body.currentStep);
    sets.push(`current_step = $${params.length}`);
  }

  if (sets.length === 0) {
    const row = await findSubmission(req.user.id);
    return res.json({ submission: serialize(row) });
  }

  const { rows } = await query(
    `UPDATE onboarding_submissions SET ${sets.join(', ')}
     WHERE user_id = $1 AND status = 'in_progress'
     RETURNING *`,
    params,
  );
  if (!rows[0]) {
    await findSubmission(req.user.id); // 404 if the row is missing entirely
    throw alreadySubmitted();
  }
  res.json({ submission: serialize(rows[0]) });
});

router.post('/submit', async (req, res) => {
  const row = await withTransaction(async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM onboarding_submissions WHERE user_id = $1 FOR UPDATE',
      [req.user.id],
    );
    const current = rows[0];
    if (!current) throw new HttpError(404, 'No onboarding submission found for this account.');
    if (current.status === 'submitted') return current; // confirming twice is harmless

    const problems = findSubmissionProblems(current);
    if (problems.length) {
      throw new HttpError(422, 'Some details still need attention before you can confirm.', {
        extra: { problems },
      });
    }
    const updated = await db.query(
      `UPDATE onboarding_submissions
       SET status = 'submitted', submitted_at = now()
       WHERE id = $1 RETURNING *`,
      [current.id],
    );
    return updated.rows[0];
  });
  res.json({ submission: serialize(row) });
});

// What each upload kind accepts. `resourceType` is how Cloudinary stores it.
const MB = 1024 * 1024;
const UPLOAD_KINDS = {
  // Product photos, testimonial photos, screenshots, logos and favicons.
  image: {
    resourceType: 'image',
    maxBytes: 10 * MB,
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
    message: 'Only JPG, PNG, WebP, GIF, SVG or ICO images can be uploaded here.',
  },
  // Homepage imagery and short clips.
  media: {
    resourceType: null, // decided per file: images -> image, videos -> video
    maxBytes: 50 * MB,
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'],
    message: 'Only images (JPG, PNG, WebP, GIF) or videos (MP4, MOV, WebM) can be uploaded here.',
  },
  // Brand guide.
  document: {
    resourceType: 'raw',
    maxBytes: 20 * MB,
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    message: 'Only a PDF or Word document can be uploaded here.',
  },
};
const MAX_UPLOAD_BYTES = Math.max(...Object.values(UPLOAD_KINDS).map((k) => k.maxBytes));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
});

// Sends each file to Cloudinary and returns its public URL; the client stores these in the step's data.
router.post('/files', upload.array('files', 10), async (req, res) => {
  const kind = UPLOAD_KINDS[req.query.kind];
  if (!kind) throw new HttpError(400, 'Unknown upload type.');

  const files = req.files ?? [];
  if (files.length === 0) throw new HttpError(400, 'Choose at least one file to upload.');
  for (const f of files) {
    if (!kind.types.includes(f.mimetype)) throw new HttpError(400, kind.message);
    if (f.size > kind.maxBytes) throw new HttpError(413, `Each file must be ${kind.maxBytes / MB} MB or smaller.`);
  }

  const row = await findSubmission(req.user.id);
  if (row.status === 'submitted') throw alreadySubmitted();

  const uploaded = await Promise.all(
    files.map(async (f) => {
      const resourceType = kind.resourceType ?? (f.mimetype.startsWith('video/') ? 'video' : 'image');
      const result = await uploadFile(f.buffer, req.user.id, resourceType);
      // originalname arrives latin1-decoded from multer; restore UTF-8 so names like "Adé.png" survive.
      const name = Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 200);
      return { ...result, name };
    }),
  );
  res.status(201).json({ files: uploaded });
});

export default router;
