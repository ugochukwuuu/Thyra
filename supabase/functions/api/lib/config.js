const env = (name) => Deno.env.get(name) ?? '';

function required(name) {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const list = (value) =>
  value
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const config = {
  isTest: env('APP_ENV') === 'test',
  // Where the React app is served from. Used for CORS and for links in emails.
  clientUrl: (env('CLIENT_URL') || 'http://localhost:5173').replace(/\/$/, ''),
  // Other origins the app itself may run on, e.g. a preview deploy. CLIENT_URL is always allowed.
  extraOrigins: list(env('EXTRA_ORIGINS')),
  // Supabase sets these for every Edge Function. Locally they come from supabase/functions/.env.
  supabaseUrl: required('SUPABASE_URL'),
  anonKey: required('SUPABASE_ANON_KEY'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  databaseUrl: required('SUPABASE_DB_URL'),
  // Sent by the hourly cron call, so nobody else can trigger the scheduled jobs.
  jobsSecret: env('JOBS_SECRET'),
  resetTokenMinutes: 15,
  // Email: Resend goes first unless EMAIL_USE_RESEND is "false", and the other provider is the fallback.
  // A provider without a key is skipped. With no keys at all, emails are only logged.
  resendApiKey: env('RESEND_API_KEY'),
  sendbyteApiKey: env('SENDBYTE_API_KEY'),
  useResendFirst: (env('EMAIL_USE_RESEND') || 'true').trim().toLowerCase() !== 'false',
  emailFrom: env('EMAIL_FROM') || 'Thyra <no-reply@thyra.co>',
  // Extra sites allowed to post to the public lead form, e.g. the WordPress landing page.
  leadOrigins: list(env('LEAD_FORM_ORIGINS')),
  cloudinary: {
    cloudName: env('CLOUDINARY_CLOUD_NAME'),
    apiKey: env('CLOUDINARY_API_KEY'),
    apiSecret: env('CLOUDINARY_API_SECRET'),
  },
};

export const cloudinaryConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret,
);
