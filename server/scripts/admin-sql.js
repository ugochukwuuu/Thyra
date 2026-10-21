// Prints the SQL that creates (or updates) an admin account, for pasting into a database
// console when `npm run seed:admin` can't reach the database (e.g. Railway's Postgres Console tab).
// The password is hashed here, so only the hash ever appears in the printed SQL.
//
//   PowerShell:  $env:ADMIN_EMAIL="you@x.com"; $env:ADMIN_PASSWORD="..."; $env:ADMIN_NAME="Your Name"
//                node scripts/admin-sql.js
import bcrypt from 'bcrypt';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || '').trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.');
if (password.length < 12) throw new Error('Set ADMIN_PASSWORD to at least 12 characters.');
if (Buffer.byteLength(password) > 72) throw new Error('ADMIN_PASSWORD must be 72 bytes or fewer.');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const hash = await bcrypt.hash(password, 12);

console.log(`INSERT INTO users (email, password_hash, role, full_name, email_verified_at)
VALUES (${q(email)}, ${q(hash)}, 'admin', ${name ? q(name) : 'NULL'}, now())
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin',
  full_name = coalesce(EXCLUDED.full_name, users.full_name), email_verified_at = coalesce(users.email_verified_at, now());`);
