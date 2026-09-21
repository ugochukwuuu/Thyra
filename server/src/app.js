import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { config } from './config.js';
import { query } from './db.js';
import { HttpError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import onboardingRoutes from './routes/onboarding.js';

const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

export function createApp() {
  const app = express();

  // Railway (and most hosts) terminate TLS at a proxy; this keeps client IPs and secure cookies correct.
  if (config.isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          mediaSrc: ["'self'", 'https://res.cloudinary.com'],
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
    }),
  );
  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    await query('SELECT 1');
    res.json({ ok: true });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  // In production the API also serves the built React app, so cookies stay same-origin.
  if (config.isProduction && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let fields;
  let extra;

  if (err instanceof HttpError) {
    ({ status, message, fields, extra } = err);
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 10 MB or smaller.' : 'Too many files at once. Upload up to 10 images.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'That request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ error: { message, ...(fields && { fields }), ...extra } });
}
