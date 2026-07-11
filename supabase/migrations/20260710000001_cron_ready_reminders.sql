-- ========================================================
-- CRON JOB: RECORDATORIOS WHATSAPP ORDENES LISTAS (CADA HORA)
-- ========================================================
-- PRERREQUISITOS (ejecutar primero en SQL Editor):
--   create extension if not exists pg_cron with schema extensions;
--   create extension if not exists pg_net with schema extensions;
--
-- REEMPLAZA <SUPABASE_URL> y <SERVICE_ROLE_KEY> con tus valores reales

select cron.schedule(
  'ready-reminders-cron',
  '0 * * * *',  -- cada hora en punto
  $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/send-ready-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  );
  $$
);
