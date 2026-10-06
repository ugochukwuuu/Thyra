# Thyra onboarding platform

This is a web application where new Thyra clients create an account, log in, and fill in a ten step onboarding form about their business and store. Thyra staff use the admin side of the same app to invite clients, review what they sent, ask for changes, export products for WooCommerce, and follow up on leads. It has a React frontend built with Vite, and an Express backend that stores everything in PostgreSQL.

## What is in the project

- `client` is the React app. It holds the client pages (login, sign up, email confirmation, password reset, legal and onboarding) and the admin pages under `/admin`.
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
- `CLIENT_URL` is the public address of the website. It is used in the links inside every email the app sends.
- `RESEND_API_KEY` and `EMAIL_FROM` control all emails: password resets, email confirmation, invites, change requests and staff notifications. Without a key, each email's link is printed in the API console instead, which is useful while developing. The sender name and reply-to address can also be set in the admin under Settings, then Onboarding form.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` control file uploads. Without them, uploads return a message saying they are not set up.
- `LEAD_FORM_ORIGINS` lists other websites, separated by commas, that may send the pre-call qualifier form to this app, for example `https://thyratechnology.com`. The app's own address is always allowed.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` are only read by the command that creates an admin account.

Resend only delivers email from its shared test sender to the address on your own Resend account. To email real clients, verify a domain in Resend and set `EMAIL_FROM` to an address on that domain.

## Creating an admin account

The first admin is created from the command line. After that, admins invite the rest of the team from Settings, then Team, and nobody can sign up as staff on the website. Staff log in at `/admin/login`.

```bash
npm run seed:admin -- you@thyra.co "a long passphrase" "Your Name"
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

Clients who sign up on their own get an email asking them to confirm their address. They can fill in the form straight away, but they can't submit it until they have clicked that link. Clients who were invited by the Thyra team skip this step, because the invite already went to their inbox.

When the client confirms on the last step, the API checks the whole form again and marks the submission as submitted, which locks it. If someone at Thyra asks for changes, the form opens again for that client, the note appears at the top of the section it is about, and the client confirms again when they are done.

## The admin

Staff sign in at `/admin/login`. There are two roles.

- Admins can do everything below.
- Viewers can read submissions and leads and download exports, but they can't change anything, and they only see their own Account and Notifications settings.

The admin has three pages.

- **Submissions** lists every client with their status: Invited, Not started, In progress, Changes requested or Submitted. Admins can invite a client from here. The invite email has a link that lasts 7 days and lets them create their account. Archived clients are hidden but can be restored.
- **Submission detail** shows what a client entered, section by section. From here an admin can ask for changes on a section, optionally ticking specific products or files, and every request is kept in the change history. Anyone can download a single file, download every file as one zip, or export the products as a CSV that WooCommerce's product importer reads. Admins can also archive a client, or delete them for good, which removes their account, their submission and their files on Cloudinary.
- **Leads** lists people who filled in the pre-call qualifier. Admins move each lead through New, Call booked, Won and Not a fit, and a won lead has a button that starts a client invite with their details filled in.

Settings has five groups. Account and Notifications belong to each person. Team, Onboarding form and Export apply to everyone, and only admins can change them. The Export settings decide the SKU prefix, whether products import as drafts or published, the stock status, and whether products without images are included in the CSV.

The server checks once an hour for clients who haven't touched their form for 7 days, and on Monday mornings (Lagos time) it sends a weekly summary. Each staff member picks which of these emails they get under Settings, then Notifications.

## The API

All routes start with `/api`. Clients are identified by an httpOnly cookie that the API sets at login.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` and `GET /auth/me` handle accounts and sessions.
- `POST /auth/forgot-password` emails a reset link that expires after 15 minutes. It gives the same answer whether or not the email has an account.
- `POST /auth/reset-password` sets a new password. Each link works once, and only the newest link for an account works.
- `GET /onboarding` returns the signed in client's submission.
- `PUT /onboarding` saves any of the nine step sections and the furthest step reached.
- `POST /onboarding/files?kind=image|media|document` uploads files to Cloudinary and returns their links.
- `POST /onboarding/submit` confirms the form. It refuses until the client has confirmed their email.
- `GET /onboarding/options` returns the social platforms and the voice input setting that admins control.
- `POST /auth/verify-email` and `POST /auth/resend-verification` handle email confirmation.
- `GET /auth/invites/:token` describes an invite link, and `POST /auth/join-team` lets an invited staff member set their name and password.
- `POST /leads` takes the pre-call qualifier form from any site listed in `LEAD_FORM_ORIGINS`. `GET /leads/options` returns the business types for its dropdown.
- Everything under `/admin` needs a staff login: clients, invites, change requests, exports, leads, team, settings, and the signed in person's own account and notifications.
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
   - `LEAD_FORM_ORIGINS`, if the pre-call qualifier form lives on another site such as the WordPress landing page
4. Deploy. The API creates the database tables the first time it starts, and `/api/health` is what Railway checks to see that it is up.
5. To use your own domain instead of the `*.up.railway.app` address Railway gives you, open the service's Settings, then Networking, then Custom Domain, and enter the subdomain you want, for example `app.thyratechnology.com`. Railway shows a CNAME record to add.

   If `thyratechnology.com` is already hosting a WordPress site elsewhere, for example on Hostinger, add that CNAME record on a subdomain, not on the bare domain, so the existing site keeps working. In Hostinger's hPanel, open the domain's DNS settings and add a record with type CNAME, name `app` (or whichever subdomain you chose), and the value Railway gave you. Railway issues its own certificate for the subdomain once the record is in place, usually within a few minutes.
6. Create your first admin account. The command has to run inside Railway, because the database's private address can't be reached from your own computer. Install the Railway command line tool, run `railway login` and `railway link` to connect it to this project, then open a shell on the running service and run the command there:

   ```bash
   railway ssh
   npm run seed:admin -- you@thyra.co "a long passphrase" "Your Name"
   ```

   You can also run it from your own computer by pointing it at the database's public address. Copy `DATABASE_PUBLIC_URL` from the Postgres service's Variables tab, set it as `DATABASE_URL` in `server/.env` together with `DATABASE_SSL=true`, and run the same `npm run seed:admin` command locally. Put your local values back afterwards.

## Things to know

- Cloudinary blocks the delivery of PDF and ZIP files on new accounts. Brand guide uploads work, but the link only opens after you allow PDF delivery in Cloudinary under Settings, then Security.
- The brand guide link downloads a file without a `.pdf` ending. The original file name is saved in the submission.
- When a client removes a photo from a product, the photo stays in Cloudinary. The API does not delete files, because a stale save from an old browser tab could otherwise delete photos that are still in use.
- A password reset does not sign out browsers that are already logged in. Their sessions end when the cookie expires after seven days.
- Until a domain is verified in Resend, Resend only delivers to the email address on your Resend account. Every other email, including invites and change requests, is refused, and the refusal is written to the API log.
- Deleting a client removes their files from Cloudinary straight away, but Cloudinary's CDN can keep serving an old copy of a file for a short while afterwards.

## Tests

The server has integration tests that run against the `thyra_test` database.

```bash
npm test
```

They cover registration, login, password reset, email confirmation, invites, every onboarding section, the rules that check a submission, file upload validation, staff roles, change requests, archiving and deleting, the WooCommerce export, leads, team management, settings, and the notification emails.
