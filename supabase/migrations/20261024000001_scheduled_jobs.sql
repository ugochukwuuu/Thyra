-- Runs the API's scheduled jobs (the "stalled for 7 days" email and the Monday summary) every hour.
-- pg_cron starts the call and pg_net makes the HTTP request. The function URL and the shared secret
-- live in Supabase Vault (see README, "Scheduled jobs"), so no secret is stored in this file.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'thyra-hourly-jobs',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'jobs_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-jobs-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'jobs_secret')
    ),
    body := '{}'::jsonb
  )
  $$
);
