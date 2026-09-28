-- Daily check for paying athletes with no Inkbound activity for 5 days.
-- The route does the work; this only triggers it with the shared notify secret.

create or replace function public.analytics_check_inactive_payers()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'analytics_notify_secret'
  limit 1;
  if secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://field-vision-analytics.vercel.app/api/inactive-check',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    timeout_milliseconds := 60000
  );
exception when others then
  null;
end;
$$;

-- 14:00 UTC is 10am Eastern.
select cron.schedule('analytics-inactive-payers', '0 14 * * *', 'select public.analytics_check_inactive_payers();');
