-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the Agorium bot to run every 4 hours.
--
-- The function reads the cron secret from the database setting
-- app.agorium_bot_secret.  Set it once in the Supabase SQL editor:
--
--   alter database postgres set app.agorium_bot_secret = 'your-secret-here';
--
-- The same value must be set as the AGORIUM_BOT_CRON_SECRET Edge Function
-- secret in the Supabase dashboard (Settings → Edge Functions → Secrets).

select cron.schedule(
  'agorium-bot-every-4h',
  '0 */4 * * *',
  $$
  select net.http_post(
    url     := 'https://auboquhnqswseneeosyj.supabase.co/functions/v1/agorium-bot',
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-agorium-bot-secret',  current_setting('app.agorium_bot_secret', true)
    ),
    body    := '{}'::jsonb
  )
  $$
);
