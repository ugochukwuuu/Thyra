import { Router } from 'express';
import cors from 'cors';
import { config } from '../config.js';
import { query } from '../db.js';
import { getSettings } from '../lib/settings.js';
import { validate } from '../middleware/validate.js';
import { leadSchema } from '../validation/admin.js';
import { limiter } from './auth.js';

// Public: the pre-call qualifier form posts here, from this app or from the WordPress site.
const router = Router();

router.use(
  cors({
    origin: [config.clientUrl, ...config.leadOrigins],
    methods: ['GET', 'POST'],
  }),
);

/** The business type choices, so the form's dropdown matches Settings > Onboarding form. */
router.get('/options', async (_req, res) => {
  const { businessTypes } = await getSettings('onboarding');
  res.json({ options: { businessTypes } });
});

router.post('/', limiter(60, 10), validate(leadSchema), async (req, res) => {
  const b = req.body;
  // Bots fill in the hidden field. Answer as if it worked, so they learn nothing.
  if (b.website) return res.status(201).json({ ok: true });

  await query(
    `INSERT INTO leads (business_name, contact_name, business_type, phone, email, budget, timeline, call_date, stage, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [b.businessName, b.contactName, b.businessType, b.phone, b.email, b.budget, b.timeline, b.callDate, b.callDate ? 'booked' : 'new', b.source],
  );
  res.status(201).json({ ok: true });
});

export default router;
