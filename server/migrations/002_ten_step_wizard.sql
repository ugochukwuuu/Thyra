-- The onboarding wizard follows the design's 10 steps. New steps get their own JSONB column,
-- alongside the existing business_info (step 1), products (step 2, the shop page),
-- about_brand (step 4) and policies (step 9).

ALTER TABLE onboarding_submissions
  ADD COLUMN home_page       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN contact_page    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN inspiration     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN visual_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN social_media    jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Step positions used to be 0..4 (business, about, products, policies, review).
-- Remap rows saved under the old numbering: about 1->3, products 2->1, policies 3->8, review 4->9.
ALTER TABLE onboarding_submissions DROP CONSTRAINT onboarding_submissions_current_step_check;
UPDATE onboarding_submissions
SET current_step = CASE current_step WHEN 1 THEN 3 WHEN 2 THEN 1 WHEN 3 THEN 8 WHEN 4 THEN 9 ELSE current_step END;
ALTER TABLE onboarding_submissions
  ADD CONSTRAINT onboarding_submissions_current_step_check CHECK (current_step BETWEEN 0 AND 9);

-- Policies gain a "help me draft this" flag, so each one becomes { text, draft }.
UPDATE onboarding_submissions
SET policies = jsonb_build_object(
  'privacy', jsonb_build_object('text', COALESCE(policies->>'privacy', ''), 'draft', false),
  'terms',   jsonb_build_object('text', COALESCE(policies->>'terms',   ''), 'draft', false),
  'returns', jsonb_build_object('text', COALESCE(policies->>'returns', ''), 'draft', false)
)
WHERE policies <> '{}'::jsonb AND jsonb_typeof(policies->'privacy') = 'string';
