// Creates (or updates) an admin account. There is deliberately no public route for this.
//
//   ADMIN_EMAIL=you@thyra.co ADMIN_PASSWORD='a long passphrase' npm run seed:admin
//   npm run seed:admin -- you@thyra.co 'a long passphrase'
import bcrypt from 'bcrypt';
import { pool } from '../src/db.js';

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.argv[3] || process.env.ADMIN_PASSWORD || '';

async function main() {
  if (!email || !password) {
    throw new Error('Provide ADMIN_EMAIL and ADMIN_PASSWORD (env vars) or pass them as arguments.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL is not a valid email address.');
  if (password.length < 12) throw new Error('Admin passwords must be at least 12 characters.');
  if (Buffer.byteLength(password) > 72) throw new Error('Admin passwords must be 72 bytes or fewer.');

  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
     RETURNING id, (xmax = 0) AS created`,
    [email, hash],
  );
  console.log(`${rows[0].created ? 'Created' : 'Updated'} admin account for ${email}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
