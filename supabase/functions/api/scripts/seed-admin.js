// Creates the first admin, or resets an existing account's password and makes it an admin.
// Reads ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME, plus the Supabase settings, from supabase/functions/.env.
// Run from the project root: npm run seed:admin
import { closeDb, query } from '../lib/db.js';
import { auth } from '../lib/supabase.js';
import { email as emailSchema, newPassword } from '../validation/auth.js';

const email = emailSchema.parse(Deno.env.get('ADMIN_EMAIL') ?? '');
const password = newPassword.parse(Deno.env.get('ADMIN_PASSWORD') ?? '');
const name = (Deno.env.get('ADMIN_NAME') ?? '').trim() || null;

const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);
let id = rows[0]?.id;
if (id) {
  await auth.updateUser(id, { password });
} else {
  id = await auth.createUser(email, password);
  if (!id) throw new Error(`${email} already has a Supabase sign-in account but no Thyra profile. Remove it under Authentication > Users, then run this again.`);
}

await query(
  `INSERT INTO users (id, email, role, full_name, email_verified_at) VALUES ($1, $2, 'admin', $3, now())
   ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = coalesce(EXCLUDED.full_name, users.full_name)`,
  [id, email, name],
);
console.log(`${rows[0] ? 'Updated' : 'Created'} admin ${email}. Log in at /admin/login.`);
await closeDb();
