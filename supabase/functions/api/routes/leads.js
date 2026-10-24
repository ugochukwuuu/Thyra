import { Hono } from 'hono';
import { query } from '../lib/db.js';
import { limiter, parseBody } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';
import { leadSchema } from '../validation/admin.js';

// Public: the pre-call qualifier form posts here, from this app or from the WordPress site.
// Which other sites may call it is set in LEAD_FORM_ORIGINS (see app.js).
const router = new Hono();

/** The business type choices, so the form's dropdown matches Settings > Onboarding form. */
router.get('/options', async (c) => {
  const { businessTypes } = await getSettings('onboarding');
  return c.json({ options: { businessTypes } });
});

router.post('/', limiter('leads', 60, 10), async (c) => {
  const b = await parseBody(c, leadSchema);
  // Bots fill in the hidden field. Answer as if it worked, so they learn nothing.
  if (b.website) return c.json({ ok: true }, 201);

  await query(
    `INSERT INTO leads (business_name, contact_name, business_type, phone, email, budget, timeline, call_date, stage, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [b.businessName, b.contactName, b.businessType, b.phone, b.email, b.budget, b.timeline, b.callDate, b.callDate ? 'booked' : 'new', b.source],
  );
  return c.json({ ok: true }, 201);
});

export default router;
