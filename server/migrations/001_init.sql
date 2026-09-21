-- Phase 1 schema: users, password_resets, onboarding_submissions.
-- Each onboarding step lives in its own JSONB column so the product/export
-- schema can keep evolving without a migration per field.

CREATE TYPE user_role AS ENUM ('client', 'admin');
CREATE TYPE submission_status AS ENUM ('in_progress', 'submitted');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Always stored lowercased and trimmed by the application.
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          user_role NOT NULL DEFAULT 'client',
  business_name text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE password_resets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 of the emailed token. The raw token is never stored.
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_resets_user_id_idx ON password_resets (user_id);

CREATE TABLE onboarding_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE enforces one active submission per client.
  user_id      uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status       submission_status NOT NULL DEFAULT 'in_progress',
  -- Wizard position, so a returning client resumes where they left off.
  current_step smallint NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 4),
  business_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  about_brand   jsonb NOT NULL DEFAULT '{}'::jsonb,
  products      jsonb NOT NULL DEFAULT '{}'::jsonb,
  policies      jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER onboarding_submissions_set_updated_at
  BEFORE UPDATE ON onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
