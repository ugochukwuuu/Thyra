# Thyra onboarding platform

This is a web application where new Thyra clients create an account, log in, and fill in a ten step onboarding form about their business and store. It has a React frontend built with Vite, and an Express backend that stores everything in PostgreSQL.

Phase 1 covers client sign up, login, password reset, the onboarding form, and admin accounts that can log in. The admin dashboard, the export, and the WordPress and WooCommerce plugin belong to Phase 2 and are not built yet.

## What is in the project

- `client` is the React app. It holds the login, sign up, forgot password, reset password, legal and onboarding pages.
- `server` is the Express API. It holds the database migrations, the routes, the tests, and a script that creates admin accounts.
- `reference` holds the build spec and the Claude Design files that the app was built from. Nothing in it runs.

## Running it on your computer

You need Node.js 20 or newer and a PostgreSQL server that is running.

1. Create two databases, one for development and one for the tests.

```bash
createdb thyra_dev
createdb thyra_test
```

2. Install everything.

```bash
npm install
npm run install:all
```

3. Copy `server/.env.example` to `server/.env` and fill it in. The settings are explained in the next section.

4. Start the API and the website together.

```bash
npm run dev
```

The website is at http://localhost:5173 and the API is at http://localhost:4000. The website sends every request that starts with `/api` to the API, so the login cookie works the same way it does in production. The API applies any new database migrations each time it starts.

## Settings

All settings live in `server/.env`, and that file is ignored by git. Never commit it.

- `DATABASE_URL` is the PostgreSQL connection string for the app.
- `TEST_DATABASE_URL` is a separate database that the tests wipe. The tests refuse to run unless its name contains "test".
- `DATABASE_SSL` should be `true` when the database needs an encrypted connection, for example Railway's public database address.
- `JWT_SECRET` signs the login cookie. In production it must be a random string of at least 32 characters. You can make one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `CLIENT_URL` is the public address of the website. It is used in the links inside password reset emails.
- `RESEND_API_KEY` and `EMAIL_FROM` control password reset emails. Without a key, the reset link is printed in the API console instead of being emailed, which is useful while developing.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` control file uploads. Without them, uploads return a message saying they are not set up.

Resend only delivers email from its shared test sender to the address on your own Resend account. To email real clients, verify a domain in Resend and set `EMAIL_FROM` to an address on that domain.

## Creating an admin account

Admins cannot sign up on the website. You create them from the command line, and they log in on the same login page as clients.

```bash
npm run seed:admin -- you@thyra.co "a long passphrase"
```

The passphrase needs at least 12 characters. Running the command again for the same email replaces that admin's password.

## How the onboarding form works

The form has ten steps, in this order.

1. Business info
2. Shop page
3. Home page
4. About the brand
5. Contact us
6. Design inspiration
7. Visual identity
8. Social media
9. Policy pages
10. Review and confirm

Every change is saved to the database about a second after typing stops, so a client can close the tab and continue later from the step they reached. Each step is stored as one JSON column on the `onboarding_submissions` table, which lets the fields change without a migration for every edit. Files such as product photos, logos and the brand guide are uploaded to Cloudinary through the API, and the database keeps the public link that Cloudinary returns.

Long text fields have a microphone button that uses the browser's built in speech recognition. It works in Chrome and Edge. Safari and iOS do not support it, so those visitors see a short message and can type instead.

When the client confirms on the last step, the API checks the whole form again, marks the submission as submitted, and locks it. A submitted form cannot be edited by the client.

## The API

All routes start with `/api`. Clients are identified by an httpOnly cookie that the API sets at login.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` and `GET /auth/me` handle accounts and sessions.
- `POST /auth/forgot-password` emails a reset link that expires after 15 minutes. It gives the same answer whether or not the email has an account.
- `POST /auth/reset-password` sets a new password. Each link works once, and only the newest link for an account works.
- `GET /onboarding` returns the signed in client's submission.
- `PUT /onboarding` saves any of the nine step sections and the furthest step reached.
- `POST /onboarding/files?kind=image|media|document` uploads files to Cloudinary and returns their links.
- `POST /onboarding/submit` confirms the form.
- `GET /health` checks that the API can reach the database.

## Deploying to Railway

The API serves the built website, so one Railway service is enough. `railway.json` in the root of the repository already tells Railway to build with `npm run build` and start with `npm start`, so you do not need to type those in.

1. On [railway.app](https://railway.app), start a new project from this GitHub repository, `ugochukwuuu/Thyra`. Railway may ask for access to the repository the first time.
2. In the same project, add a PostgreSQL database. Click "New", then "Database", then "Add PostgreSQL".
3. Open the web service, the one built from the repository, and add these variables under its Variables tab.
   - `NODE_ENV=production`
   - `DATABASE_URL` set to a reference to the database, not typed by hand. Click "Add Reference" and pick the Postgres service's `DATABASE_URL`. Railway writes this as `${{Postgres.DATABASE_URL}}`, and it uses Railway's private network, so leave `DATABASE_SSL` unset.
   - `JWT_SECRET`, a random string of at least 32 characters. You can make one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   - `CLIENT_URL`, the public address you plan to use, for example `https://app.thyratechnology.com`. You can fill this in after step 5 once you know it, then let Railway redeploy.
   - `RESEND_API_KEY` and `EMAIL_FROM`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`
4. Deploy. The API creates the database tables the first time it starts, and `/api/health` is what Railway checks to see that it is up.
5. To use your own domain instead of the `*.up.railway.app` address Railway gives you, open the service's Settings, then Networking, then Custom Domain, and enter the subdomain you want, for example `app.thyratechnology.com`. Railway shows a CNAME record to add.

   If `thyratechnology.com` is already hosting a WordPress site elsewhere, for example on Hostinger, add that CNAME record on a subdomain, not on the bare domain, so the existing site keeps working. In Hostinger's hPanel, open the domain's DNS settings and add a record with type CNAME, name `app` (or whichever subdomain you chose), and the value Railway gave you. Railway issues its own certificate for the subdomain once the record is in place, usually within a few minutes.
6. Create your first admin account. Install the Railway command line tool, run `railway login` and `railway link` to connect it to this project, then run:

   ```bash
   railway run npm run seed:admin -- you@thyra.co "a long passphrase"
   ```

## Things to know

- Cloudinary blocks the delivery of PDF and ZIP files on new accounts. Brand guide uploads work, but the link only opens after you allow PDF delivery in Cloudinary under Settings, then Security.
- The brand guide link downloads a file without a `.pdf` ending. The original file name is saved in the submission.
- When a client removes a photo from a product, the photo stays in Cloudinary. The API does not delete files, because a stale save from an old browser tab could otherwise delete photos that are still in use.
- A password reset does not sign out browsers that are already logged in. Their sessions end when the cookie expires after seven days.
- There is no admin route for reading submissions yet. Phase 2 needs to add one, and the JSON columns on `onboarding_submissions` are the shape it will return.

## Tests

The server has integration tests that run against the `thyra_test` database.

```bash
npm test
```

They cover registration, login, password reset, every onboarding section, the rules that check a submission, and file upload validation.
