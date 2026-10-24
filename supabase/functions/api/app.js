import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './lib/config.js';
import { query } from './lib/db.js';
import { HttpError } from './lib/errors.js';
import { runJobs } from './lib/jobs.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import leadRoutes from './routes/leads.js';
import onboardingRoutes from './routes/onboarding.js';

// The app's own origins. Requests carry a Supabase access token, not a cookie, so no credentials mode is needed.
const appOrigins = [config.clientUrl, ...config.extraOrigins];

export function createApp() {
  // Supabase serves this function at /functions/v1/api, and passes the path on from /api.
  const app = new Hono().basePath('/api');

  // Public lead form: registered before the app-wide rule because it accepts other sites too.
  app.use('/leads/*', cors({ origin: [...appOrigins, ...config.leadOrigins], allowMethods: ['GET', 'POST'] }));
  app.use('*', (c, next) => {
    if (c.req.path.startsWith('/api/leads')) return next();
    return cors({ origin: appOrigins, allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], exposeHeaders: ['Content-Disposition'] })(c, next);
  });

  app.get('/health', async (c) => {
    await query('SELECT 1');
    return c.json({ ok: true });
  });

  // Called hourly by pg_cron with the shared secret (see the scheduled_jobs migration).
  app.post('/jobs', async (c) => {
    if (!config.jobsSecret || c.req.header('x-jobs-secret') !== config.jobsSecret) throw new HttpError(401, 'Not allowed.');
    return c.json(await runJobs());
  });

  app.route('/auth', authRoutes);
  app.route('/onboarding', onboardingRoutes);
  app.route('/admin', adminRoutes);
  app.route('/leads', leadRoutes);

  app.notFound((c) => c.json({ error: { message: 'Not found.' } }, 404));
  app.onError((err, c) => {
    let status = 500;
    let message = 'Something went wrong on our side. Please try again.';
    let fields;
    let extra;
    if (err instanceof HttpError) ({ status, message, fields, extra } = err);
    if (status >= 500) console.error(err);
    return c.json({ error: { message, ...(fields && { fields }), ...extra } }, status);
  });

  return app;
}
