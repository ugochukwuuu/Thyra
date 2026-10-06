-- Admin platform: staff roles, client and staff invites, email verification,
-- change requests, archiving, leads, settings, and notification bookkeeping.

-- updated_at is refreshed on every write, unless the write sets updated_at itself.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Viewers are staff who can read and export submissions but not change anything.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'changes_requested';

ALTER TABLE users
  -- Staff: their own name. Clients: the contact person for the business.
  ADD COLUMN full_name text,
  ADD COLUMN email_verified_at timestamptz,
  -- Clients only: hidden from the admin's default list, but kept.
  ADD COLUMN archived_at timestamptz,
  -- Staff only: which notification emails they get, and where.
  ADD COLUMN notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Clients only: when the "stalled for 7 days" email last went out, so it is sent once per stall.
  -- Kept here rather than on onboarding_submissions, where any write would bump its updated_at.
  ADD COLUMN stalled_notified_at timestamptz;

-- Accounts that existed before verification was introduced are treated as verified.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE email_verifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verifications_user_id_idx ON email_verifications (user_id);

CREATE TYPE invite_kind AS ENUM ('client', 'staff');

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

CREATE TYPE lead_stage AS ENUM ('new', 'booked', 'won', 'notfit');

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
