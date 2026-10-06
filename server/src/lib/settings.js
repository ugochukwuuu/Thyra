import { query } from '../db.js';

// Defaults come from the admin Settings design. Stored values are merged over these,
// so adding a new setting later never needs a data migration.
export const DEFAULTS = {
  onboarding: {
    businessTypes: [
      'Fashion & apparel',
      'Beauty & skincare',
      'Jewellery & accessories',
      'Food & drink',
      'Home & living',
      'Health & wellness',
      'Kids & baby',
      'Other',
    ],
    socialPlatforms: ['Instagram', 'TikTok', 'Facebook', 'X', 'WhatsApp', 'YouTube'],
    voiceInput: true,
    // Hours a client's email verification link stays valid: 24, 48 or 168 (7 days).
    verificationHours: 24,
    senderName: 'Thyra Technologies',
    replyTo: '',
  },
  export: {
    skuPrefix: 'THY-',
    importAs: 'draft', // 'draft' | 'published'
    stockStatus: 'instock', // 'instock' | 'outofstock' | 'onbackorder'
    includeNoImages: false,
  },
  // Not editable in the UI: bookkeeping for scheduled emails.
  jobs: { weeklySummarySentFor: null },
};

export const NOTIFICATION_DEFAULTS = { signup: true, submitted: true, stalled: true, weekly: false, to: '' };

export async function getSettings(key, db = { query }) {
  const { rows } = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return { ...DEFAULTS[key], ...(rows[0]?.value ?? {}) };
}

export async function saveSettings(key, value, userId, db = { query }) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(value), userId],
  );
  return getSettings(key, db);
}

export const notificationPrefs = (user) => ({
  ...NOTIFICATION_DEFAULTS,
  ...(user.notification_prefs ?? {}),
  to: user.notification_prefs?.to || user.email,
});
