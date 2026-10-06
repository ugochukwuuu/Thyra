const env = process.env;

const isProduction = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (isProduction && (jwtSecret.length < 32 || jwtSecret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be a random string of at least 32 characters in production.');
}

export const config = {
  isProduction,
  isTest,
  port: Number(env.PORT) || 4000,
  clientUrl: (env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, ''),
  databaseUrl: isTest ? required('TEST_DATABASE_URL') : required('DATABASE_URL'),
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret,
  sessionDays: Number(env.JWT_EXPIRES_IN_DAYS) || 7,
  resetTokenMinutes: 15,
  resendApiKey: env.RESEND_API_KEY || '',
  emailFrom: env.EMAIL_FROM || 'Thyra <no-reply@thyra.co>',
  // Extra sites allowed to post to the public lead form, e.g. the WordPress landing page.
  leadOrigins: (env.LEAD_FORM_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: env.CLOUDINARY_API_KEY || '',
    apiSecret: env.CLOUDINARY_API_SECRET || '',
  },
};

export const cloudinaryConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret,
);
