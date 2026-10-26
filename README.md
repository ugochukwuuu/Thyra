# Thyra onboarding platform

This is a web application where new Thyra clients create an account, log in, and fill in a ten step onboarding form about their business and store. Thyra staff use the admin side of the same app to invite clients, review what they sent, ask for changes, export products for WooCommerce, and follow up on leads. The website is a React app built with Vite. Everything behind it runs on Supabase: Supabase Auth handles sign-in, the data is in Supabase's PostgreSQL database, and the API is a Supabase Edge Function.

## What is in the project

- `client` is the React app. It holds the client pages (login, sign up, email confirmation, password reset, legal and onboarding) and the admin pages under `/admin`. It builds to plain files, so any static host can serve it.
- `supabase/functions/api` is the API, one Edge Function. It holds the routes, the tests, and a script that creates admin accounts.
- `supabase/migrations` holds the database schema and the hourly schedule for the jobs that send reminder emails.
- `reference` holds the build spec and the Claude Design files that the app was built from. Nothing in it runs.

## How the pieces fit

- People sign in on the website with Supabase Auth, which keeps their session in the browser.
- The website then calls the API with the person's access token. The API checks the token, works out who the person is and what they may do, and reads and writes the database.
- The browser never reads the database tables directly. Every table has row level security turned on with no rules, which blocks Supabase's built in table API. The Edge Function connects as the database owner, so it is not affected.
- Accounts are always created by the API, never by the website talking to Supabase Auth on its own. That keeps invites, email confirmation and the app's own user records in step. Public sign-up in Supabase Auth should be turned off (see Deploying).
- Uploaded files go straight from the browser to Cloudinary. The API only hands out a signature that lets the browser upload into that client's own folder.

## Running it on your computer

You need Node.js 20 or newer, [Deno](https://deno.com) 2 (`npm install -g deno` works), and a local PostgreSQL server for the tests.

1. Install everything.

```bash
npm install
npm run install:all
```

2. Copy `supabase/functions/.env.example` to `supabase/functions/.env` and fill it in. Copy `client/.env.example` to `client/.env`, and add `VITE_API_URL=http://localhost:8000/api` to it so the website uses the API on your computer. The settings are explained in the next section.

3. Start the API and the website together.

```bash
npm run dev
```

The website is at http://localhost:5173 and the API is at http://localhost:8000/api. The local API uses the real Supabase project's database and sign-in accounts, so anything you do locally shows up there too.

## Settings

The API's settings live in `supabase/functions/.env` on your computer, and in Supabase's Edge Function secrets in production. That file is ignored by git. Never commit it.

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` connect the API to the Supabase project. The keys are under Project Settings, then API Keys. The database address is under Connect, then Session pooler. Supabase sets all four itself for the deployed function, so they are only needed locally. The service role key can do anything in the project, so it must never go in the website's settings.
- `CLIENT_URL` is the public address of the website. It is used for the links inside every email the app sends, and only that address may call the API from a browser. `EXTRA_ORIGINS` can list more addresses, separated by commas, for example a preview deploy.
- `JOBS_SECRET` is a long random string that the hourly schedule sends to the API, so nobody else can trigger the reminder emails. You can make one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `RESEND_API_KEY`, `SENDBYTE_API_KEY`, `EMAIL_USE_RESEND` and `EMAIL_FROM` control all emails: password resets, email confirmation, invites, change requests and staff notifications. The app uses two providers, so one can stand in when the other fails. With `EMAIL_USE_RESEND=true`, the default, each email goes through Resend first, and through SendByte only if Resend rejects it or can't be reached. With `EMAIL_USE_RESEND=false`, SendByte goes first and Resend is the fallback. A provider without a key is skipped, and with no keys at all each email's link is printed in the API log instead, which is useful while developing. SendByte test keys (`sk_test_`) only record emails in SendByte's dashboard and never deliver them. The sender name and reply-to address can also be set in the admin under Settings, then Onboarding form.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` control file uploads. Without them, uploads return a message saying they are not set up.
- `LEAD_FORM_ORIGINS` lists other websites, separated by commas, that may send the pre-call qualifier form to the API, for example `https://thyratechnology.com`.
- `TEST_DATABASE_URL` is a local database that the tests wipe. The tests refuse to run unless its name contains "test".
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` are only read by the command that creates an admin account.

The website has its own settings in `client/.env`, and in the static host's settings in production. The anon key is meant to be public, so it is safe in the website.

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the same project address and anon key as above.
- `VITE_API_URL` is only needed when the API is not the deployed Edge Function, for example `http://localhost:8000/api` while developing.

## Creating an admin account

The first admin is created from the command line. After that, admins invite the rest of the team from Settings, then Team, and nobody can sign up as staff on the website. Staff log in at `/admin/login`.

Put the admin's details in `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` in `supabase/functions/.env`, then run:

```bash
npm run seed:admin
```

Running it again for the same email resets that admin's password.

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

Every change is saved to the database about a second after typing stops, so a client can close the tab and continue later from the step they reached. Each step is stored as one JSON column on the `onboarding_submissions` table, which lets the fields change without a migration for every edit. Files such as product photos, logos and the brand guide go straight from the browser to Cloudinary, and the database keeps the public link that Cloudinary returns. The browser checks each file's type and size before it uploads: images up to 10 MB, home page photos and videos up to 50 MB, and documents up to 20 MB.

Long text fields have a microphone button that uses the browser's built in speech recognition. It works in Chrome and Edge. Safari and iOS do not support it, so those visitors see a short message and can type instead.

Clients who sign up on their own get an email asking them to confirm their address. They can fill in the form straight away, but they can't submit it until they have clicked that link. Clients who were invited by the Thyra team skip this step, because the invite already went to their inbox.

When the client confirms on the last step, the API checks the whole form again and marks the submission as submitted, which locks it. If someone at Thyra asks for changes, the form opens again for that client, the note appears at the top of the section it is about, and the client confirms again when they are done.

## The admin

Staff sign in at `/admin/login`. There are two roles.

- Admins can do everything below.
- Viewers can read submissions and leads and download exports, but they can't change anything, and they only see their own Account and Notifications settings.

The admin has three pages.

- **Submissions** lists every client with their status: Invited, Not started, In progress, Changes requested or Submitted. Admins can invite a client from here. The invite email has a link that lasts 7 days and lets them create their account. Archived clients are hidden but can be restored.
- **Submission detail** shows what a client entered, section by section. From here an admin can ask for changes on a section, optionally ticking specific products or files, and every request is kept in the change history. Anyone can download a single file, download every file as one zip, or export the products as a CSV that WooCommerce's product importer reads. The zip is put together in the browser, straight from Cloudinary. Admins can also archive a client, or delete them for good, which removes their account, their submission and their files on Cloudinary.
- **Leads** lists people who filled in the pre-call qualifier. Admins move each lead through New, Call booked, Won and Not a fit, and a won lead has a button that starts a client invite with their details filled in.

Settings has five groups. Account and Notifications belong to each person. Team, Onboarding form and Export apply to everyone, and only admins can change them. The Export settings decide the SKU prefix, whether products import as drafts or published, the stock status, and whether products without images are included in the CSV.

Once an hour the database calls the API to look for clients who haven't touched their form for 7 days, and on Monday mornings (Lagos time) the same call sends a weekly summary. Each staff member picks which of these emails they get under Settings, then Notifications.

## The API

The deployed API is at `https://<project-ref>.supabase.co/functions/v1/api`, and every route below starts with `/api`. Signed in requests carry the Supabase access token in an `Authorization: Bearer` header. Logging in and out happens in the browser through Supabase Auth, so there are no API routes for it.

- `POST /auth/register` creates a client account. `GET /auth/me` returns the signed in person.
- `POST /auth/forgot-password` emails a reset link. Client links expire after 15 minutes and staff links after an hour. It gives the same answer whether or not the email has an account.
- `POST /auth/reset-password` sets a new password. Each link works once, and only the newest link for an account works.
- `POST /auth/verify-email` and `POST /auth/resend-verification` handle email confirmation.
- `GET /auth/invites/:token` describes an invite link, and `POST /auth/join-team` lets an invited staff member set their name and password.
- `GET /onboarding` returns the signed in client's submission.
- `PUT /onboarding` saves any of the nine step sections and the furthest step reached.
- `POST /onboarding/files/signature` returns a signature for uploading files to Cloudinary, into the client's own folder.
- `POST /onboarding/submit` confirms the form. It refuses until the client has confirmed their email.
- `GET /onboarding/options` returns the social platforms and the voice input setting that admins control.
- `POST /leads` takes the pre-call qualifier form from any site listed in `LEAD_FORM_ORIGINS`. `GET /leads/options` returns the business types for its dropdown.
- Everything under `/admin` needs a staff login: clients, invites, change requests, the product CSV, leads, team, settings, and the signed in person's own account and notifications.
- `POST /jobs` runs the hourly jobs. It only answers when the request carries `JOBS_SECRET`.
- `GET /health` checks that the API can reach the database.

Sign-up, password reset, email confirmation, joining the team and the lead form are limited per IP address, so they can't be used to flood inboxes.

## Deploying

The deploy has two parts: the API and database on Supabase, and the website on a static host. Run these from the root of the project.

1. Log in to the Supabase command line tool and link it to the project.

   ```bash
   npx supabase login
   npx supabase link --project-ref jlnajywuapunazewyxab
   ```

2. Create the database tables and the hourly schedule.

   ```bash
   npm run db:push
   ```

3. Store the API's settings as Edge Function secrets. Put the production values in a file such as `supabase/functions/.env.production` (git ignores it), with `CLIENT_URL` set to the website's public address, then run:

   ```bash
   npx supabase secrets set --env-file supabase/functions/.env.production
   ```

   Leave out the four `SUPABASE_` settings and the local-only ones, because Supabase provides the first and the function never reads the second.

4. Deploy the API.

   ```bash
   npm run deploy:api
   ```

5. Tell the database where to send the hourly call, and the secret to send with it. In the Supabase dashboard, open the SQL Editor and run this once, with your own `JOBS_SECRET`:

   ```sql
   select vault.create_secret('https://jlnajywuapunazewyxab.supabase.co/functions/v1/api/jobs', 'jobs_url');
   select vault.create_secret('the same value as JOBS_SECRET', 'jobs_secret');
   ```

6. In the Supabase dashboard, open Authentication, then Sign In / Providers, and turn off "Allow new users to sign up". The API still creates accounts, but nobody can sign up by calling Supabase Auth directly and skip the app's own checks.

7. Create your first admin with `npm run seed:admin` (see above).

8. Put the website on Netlify. On [app.netlify.com](https://app.netlify.com), choose "Add new project", then "Import an existing project", pick GitHub and this repository, and deploy. `netlify.toml` in the root of the repository already sets the folder, the build command, and the Supabase address and anon key, so there is nothing to type in. `client/public/_redirects` sends every address to the app, so links such as `/admin/submissions` work when opened directly.

9. Add your domain, `onboarding.thyratechnology.com`, under the Netlify project's Domain management, and make it the primary domain. The WordPress site stays on the bare domain on Hostinger, so the app lives on a subdomain: in Hostinger's hPanel, open the domain's DNS settings and add a CNAME record named `onboarding` with the value `thyra-onboarding.netlify.app`. Netlify then issues the HTTPS certificate. Make sure `CLIENT_URL` matches the final address, and run step 3 again if it changes.

   Avoid `app.thyratechnology.com` for now: Hostinger's servers still return an old Railway record for it that hPanel no longer shows, and only Hostinger support can remove it.

## Things to know

- Cloudinary blocks the delivery of PDF and ZIP files on new accounts. Brand guide uploads work, but the link only opens after you allow PDF delivery in Cloudinary under Settings, then Security.
- The brand guide link downloads a file without a `.pdf` ending. The original file name is saved in the submission.
- When a client removes a photo from a product, the photo stays in Cloudinary. The API does not delete files, because a stale save from an old browser tab could otherwise delete photos that are still in use.
- A password reset does not sign out browsers that are already logged in. Supabase keeps those sessions until they are signed out or expire.
- Until a domain is verified in Resend, Resend only delivers to the email address on your Resend account. Every other email, including invites and change requests, is refused, and the refusal is written to the API log (Edge Functions, then api, then Logs).
- Deleting a client removes their files from Cloudinary straight away, but Cloudinary's CDN can keep serving an old copy of a file for a short while afterwards.

## Tests

The API has integration tests that run against the local `thyra_test` database. They use a stand-in for Supabase Auth, so they never touch the real project.

```bash
npm test
```

They cover registration, password reset, email confirmation, invites, every onboarding section, the rules that check a submission, upload signatures, staff roles, change requests, archiving and deleting, the WooCommerce export, leads, team management, settings, the scheduled jobs, and the notification emails.
