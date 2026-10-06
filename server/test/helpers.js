import assert from 'node:assert/strict';
import { after, before, beforeEach } from 'node:test';

// Must be set before the app modules are imported: config reads it at load time.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-test';

const { createApp } = await import('../src/app.js');
const { pool, query } = await import('../src/db.js');
const { migrate } = await import('../scripts/migrate.js');
const { mailer } = await import('../src/lib/email.js');
const { userFolder } = await import('../src/lib/cloudinary.js');
const bcrypt = (await import('bcrypt')).default;

export { bcrypt, mailer, query, userFolder };

let server;
export const ctx = { base: '', sent: [] };

/** Registers the shared hooks: a migrated, empty test database and a running app for each file. */
export function useTestApp() {
  before(async () => {
    // These tests TRUNCATE users, so refuse to run against anything that isn't obviously a test database.
    const { rows } = await query('SELECT current_database() AS name');
    assert.match(rows[0].name, /test/, `Refusing to run tests against database "${rows[0].name}"`);
    await migrate({ log: () => {} });
    server = createApp().listen(0);
    ctx.base = `http://localhost:${server.address().port}`;
  });

  after(async () => {
    server.close();
    await pool.end();
  });

  beforeEach(async () => {
    await query('TRUNCATE users, invites, leads, app_settings CASCADE');
    ctx.sent = [];
    // Capture every email instead of sending it.
    mailer.deliver = async (msg) => {
      ctx.sent.push(msg);
    };
  });
}

/** The token in the link of the most recent email of this kind. */
export function tokenFrom(kind) {
  const msg = [...ctx.sent].reverse().find((m) => m.kind === kind);
  assert.ok(msg, `expected a "${kind}" email`);
  const params = new URL(msg.link).searchParams;
  return params.get('token') ?? params.get('invite');
}

/** Minimal fetch wrapper that keeps cookies, like a browser tab would. */
export function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(ctx.base + path, {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(';')[0];
      cookie = pair.endsWith('=') ? '' : pair;
    }
    const type = res.headers.get('content-type') ?? '';
    const text = await res.text();
    return { status: res.status, body: type.includes('json') && text ? JSON.parse(text) : text, headers: res.headers };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b),
    hasCookie: () => cookie !== '',
    cookie: () => cookie,
  };
}

export const signup = (overrides = {}) => ({
  businessName: 'Ade Fine Jewellery',
  email: 'ade@example.com',
  password: 'correct horse',
  confirmPassword: 'correct horse',
  ...overrides,
});

export async function registered(overrides) {
  const c = client();
  const res = await c.post('/api/auth/register', signup(overrides));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { c, user: res.body.user };
}

/** A logged-in staff member. */
export async function staff(role = 'admin', email = `${role}@thyra.co`, fullName = 'Eze Mitchel') {
  const hash = await bcrypt.hash('staff passphrase 1', 4);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, role, full_name, email_verified_at) VALUES ($1, $2, $3, $4, now()) RETURNING id`,
    [email, hash, role, fullName],
  );
  const c = client();
  const res = await c.post('/api/auth/login', { email, password: 'staff passphrase 1', scope: 'staff' });
  assert.equal(res.status, 200);
  return { c, id: rows[0].id };
}

export const verifyEmail = (userId) => query('UPDATE users SET email_verified_at = now() WHERE id = $1', [userId]);
