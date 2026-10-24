-- Thyra schema. Supabase Auth stores sign-in details (email, password, sessions) in auth.users;
-- public.users holds the app's side of each account and shares its id.
-- Every table has row level security on and no policies: the browser never reads tables directly.
-- All access goes through the `api` Edge Function, which connects as the table owner.

CREATE TYPE user_role AS ENUM ('client', 'admin', 'viewer');
CREATE TYPE submission_status AS ENUM ('in_progress', 'submitted', 'changes_requested');
CREATE TYPE invite_kind AS ENUM ('client', 'staff');
CREATE TYPE lead_stage AS ENUM ('new', 'booked', 'won', 'notfit');

-- updated_at is refreshed on every write, unless the write sets updated_at itself.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- A copy of the sign-in email, always lowercased. Kept in step by the API.
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  role          user_role NOT NULL DEFAULT 'client',
  business_name text,
  -- Staff: their own name. Clients: the contact person for the business.
  full_name     text,
  email_verified_at timestamptz,
  -- Clients only: hidden from the admin's default list, but kept.
  archived_at   timestamptz,
  -- Staff only: which notification emails they get, and where.
  notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Clients only: when the "stalled for 7 days" email last went out, so it is sent once per stall.
  stalled_notified_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Single-use links. Only a SHA-256 of each emailed token is stored.
CREATE TABLE password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_id_idx ON password_resets (user_id);

CREATE TABLE email_verifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verifications_user_id_idx ON email_verifications (user_id);

-- Each wizard section lives in its own JSONB column, so the form can evolve without a migration per field.
CREATE TABLE onboarding_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status          submission_status NOT NULL DEFAULT 'in_progress',
  -- The furthest wizard step reached (0-9), so a returning client resumes there.
  current_step    smallint NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 9),
  business_info   jsonb NOT NULL DEFAULT '{}'::jsonb,
  products        jsonb NOT NULL DEFAULT '{}'::jsonb,
  home_page       jsonb NOT NULL DEFAULT '{}'::jsonb,
  about_brand     jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_page    jsonb NOT NULL DEFAULT '{}'::jsonb,
  inspiration     jsonb NOT NULL DEFAULT '{}'::jsonb,
  visual_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  social_media    jsonb NOT NULL DEFAULT '{}'::jsonb,
  policies        jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER onboarding_submissions_set_updated_at BEFORE UPDATE ON onboarding_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          invite_kind NOT NULL,
  email         text NOT NULL CHECK (email = lower(email)),
  -- Staff invites: the role the person gets. Client invites: always 'client'.
  role          user_role NOT NULL,
  business_name text,
  contact_name  text,
  note          text,
  token_hash    text NOT NULL UNIQUE,
  invited_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at    timestamptz NOT NULL,
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- At most one open invite per email address.
CREATE UNIQUE INDEX invites_open_email_idx ON invites (email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TRIGGER invites_set_updated_at BEFORE UPDATE ON invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE change_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES onboarding_submissions(id) ON DELETE CASCADE,
  -- Wizard position of the section, 0 (business info) to 8 (policies).
  step          smallint NOT NULL CHECK (step BETWEEN 0 AND 8),
  message       text NOT NULL,
  -- Names of the specific products or files the admin ticked, if any.
  flagged_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Set when the client confirms their details again.
  resolved_at   timestamptz
);
CREATE INDEX change_requests_submission_idx ON change_requests (submission_id);

CREATE TABLE leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  contact_name  text NOT NULL DEFAULT '',
  business_type text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  email         text NOT NULL,
  budget        text NOT NULL DEFAULT '',
  timeline      text NOT NULL DEFAULT '',
  call_date     date,
  stage         lead_stage NOT NULL DEFAULT 'new',
  source        text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Workspace-wide settings, one JSON document per group ('onboarding', 'export', 'jobs').
CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Request counts per IP address for the public routes (sign-up, password reset, lead form).
-- Rows older than a day are cleared by the hourly jobs.
CREATE TABLE rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
