import assert from 'node:assert/strict';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach } from '@std/testing/bdd';

// Must be set before the app modules are imported: config reads them at load time.
// Tests run against a local PostgreSQL database and a fake Supabase Auth (below), never the real project.
const testDb = Deno.env.get('TEST_DATABASE_URL') ?? 'postgres://postgres@localhost:5432/thyra_test';
Deno.env.set('APP_ENV', 'test');
Deno.env.set('SUPABASE_DB_URL', testDb);
Deno.env.set('SUPABASE_URL', 'http://supabase.test');
Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
Deno.env.set('JOBS_SECRET', 'test-jobs-secret');
for (const name of ['RESEND_API_KEY', 'SENDBYTE_API_KEY', 'CLOUDINARY_CLOUD_NAME']) Deno.env.delete(name);

const { createApp } = await import('../app.js');
const { closeDb, query } = await import('../lib/db.js');
const { mailer } = await import('../lib/email.js');
const { userFolder } = await import('../lib/cloudinary.js');
const { auth } = await import('../lib/supabase.js');

export { mailer, query, userFolder };

const app = createApp();
export const ctx = { sent: [] };

// ---- A fake Supabase Auth: accounts in memory, plus a row in the stub auth.users table for the foreign key.

const accounts = new Map(); // id -> { email, password }
const findAccount = (email) => [...accounts].find(([, a]) => a.email === email);

auth.createUser = async (email, password) => {
  if (findAccount(email)) return null;
  const id = crypto.randomUUID();
  await query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, email]);
  accounts.set(id, { email, password });
  return id;
};
auth.updateUser = async (id, { email, password }) => {
  const account = accounts.get(id);
  if (email && findAccount(email)?.[0] !== undefined && findAccount(email)[0] !== id) return false;
  if (email) account.email = email;
  if (password) account.password = password;
  return true;
};
auth.deleteUser = async (id) => {
  await query('DELETE FROM auth.users WHERE id = $1', [id]);
  accounts.delete(id);
};
auth.passwordMatches = async (email, password) => findAccount(email)?.[1].password === password;
auth.userIdFromToken = async (token) => {
  const id = token.replace(/^test-token-/, '');
  return accounts.has(id) ? id : null;
};

/** What the browser's supabase.auth.signInWithPassword does: an access token, or null. */
export function signIn(email, password) {
  const found = findAccount(email);
  return found && found[1].password === password ? `test-token-${found[0]}` : null;
}

export const passwordOf = (email) => findAccount(email)?.[1].password;

/** Registers the shared hooks: a fresh schema, an empty database before each test, and captured emails. */
export function useTestApp() {
  beforeAll(async () => {
    const sql = postgres(testDb, { onnotice: () => {} });
    // These tests drop the whole schema, so refuse to run against anything that isn't obviously a test database.
    const [{ name }] = await sql`SELECT current_database() AS name`;
    assert.match(name, /test/, `Refusing to run tests against database "${name}"`);
    const schema = await Deno.readTextFile(new URL('../../../migrations/20261024000000_schema.sql', import.meta.url));
    await sql.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      CREATE SCHEMA IF NOT EXISTS auth;
      DROP TABLE IF EXISTS auth.users CASCADE;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
      ${schema}`);
    await sql.end();
  });

  afterAll(() => closeDb());

  beforeEach(async () => {
    await query('TRUNCATE auth.users, invites, leads, app_settings, rate_limits CASCADE');
    accounts.clear();
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

/** Calls the API like the browser does: JSON in and out, with the access token once signed in. */
export function client() {
  let token = null;
  const call = async (method, path, body, headers = {}) => {
    const res = await app.fetch(
      new Request(`http://api.test${path}`, {
        method,
        headers: {
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    );
    const type = res.headers.get('content-type') ?? '';
    const text = await res.text();
    return { status: res.status, body: type.includes('json') && text ? JSON.parse(text) : text, headers: res.headers };
  };
  return {
    get: (p, headers) => call('GET', p, undefined, headers),
    post: (p, b = {}, headers) => call('POST', p, b, headers),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b),
    /** Signs in with an email and password. Returns false when they don't match. */
    signIn: (email, password) => Boolean((token = signIn(email, password))),
    signOut: () => (token = null),
  };
}

export const signup = (overrides = {}) => ({
  businessName: 'Ade Fine Jewellery',
  email: 'ade@example.com',
  password: 'correct horse',
  confirmPassword: 'correct horse',
  ...overrides,
});

/** A registered client, signed in. */
export async function registered(overrides) {
  const c = client();
  const body = signup(overrides);
  const res = await c.post('/api/auth/register', body);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(c.signIn(res.body.user.email, body.password));
  return { c, user: res.body.user };
}

/** A signed-in staff member. */
export async function staff(role = 'admin', email = `${role}@thyra.co`, fullName = 'Eze Mitchel') {
  const id = await auth.createUser(email, 'staff passphrase 1');
  await query(
    `INSERT INTO users (id, email, role, full_name, email_verified_at) VALUES ($1, $2, $3, $4, now())`,
    [id, email, role, fullName],
  );
  const c = client();
  assert.ok(c.signIn(email, 'staff passphrase 1'));
  return { c, id };
}

export const verifyEmail = (userId) => query('UPDATE users SET email_verified_at = now() WHERE id = $1', [userId]);
