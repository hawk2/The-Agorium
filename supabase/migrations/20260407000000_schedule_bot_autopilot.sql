-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the Agorium bot to run every 4 hours.
--
-- Replace 'YOUR_SECRET_HERE' with the value of AGORIUM_BOT_CRON_SECRET
-- set in Supabase Dashboard → Edge Functions → Secrets.
-- To change the secret later, run: select cron.unschedule('agorium-bot-every-4h');
-- then re-run this statement with the new value.

select cron.schedule(
  'agorium-bot-every-4h',
  '0 */4 * * *',
  $$
  select net.http_post(
    url     := 'https://auboquhnqswseneeosyj.supabase.co/functions/v1/agorium-bot',
    headers := '{"Content-Type": "application/json", "x-agorium-bot-secret": "YOUR_SECRET_HERE"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);
