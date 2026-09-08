-- Founder push notifications: every product event the analytics app should
-- know about posts to /api/notify. The webhook secret lives in Vault under
-- analytics_notify_secret (create it once with vault.create_secret).

create or replace function public.analytics_notify_post(payload jsonb)
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
    url := 'https://field-vision-analytics.vercel.app/api/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', secret),
    timeout_milliseconds := 5000
  );
exception when others then
  null;
end;
$$;

create or replace function public.analytics_notify_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.analytics_notify_post(jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'record', to_jsonb(NEW),
    'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
  ));
  return NEW;
end;
$$;

-- Signups are not feed events and the profile trial flag carries no plan;
-- both are now covered by user_subscriptions changes.
drop trigger if exists analytics_notify_signup on public.user_profiles;
drop trigger if exists analytics_notify_trial on public.user_profiles;

-- Subscriptions: trial start, payment, plan change, cancellation.
drop trigger if exists analytics_notify_sub_insert on public.user_subscriptions;
create trigger analytics_notify_sub_insert
  after insert on public.user_subscriptions
  for each row
  execute function public.analytics_notify_event();

drop trigger if exists analytics_notify_sub_update on public.user_subscriptions;
create trigger analytics_notify_sub_update
  after update on public.user_subscriptions
  for each row
  when (
    old.paid_at is distinct from new.paid_at
    or old.plan is distinct from new.plan
    or old.payment_type is distinct from new.payment_type
    or old.amount_cents is distinct from new.amount_cents
  )
  execute function public.analytics_notify_event();

-- Paywall screens (onboarding flow) and the accepted cancellation save offer.
drop trigger if exists analytics_notify_product_event on public.product_events;
create trigger analytics_notify_product_event
  after insert on public.product_events
  for each row
  when (
    (new.name = 'onboarding_screen_view'
      and (new.properties->>'screen') in ('s37_paywall', 's37c_spin_wheel', 's38_one_time_offer'))
    or new.name = 'retention_offer_accepted'
  )
  execute function public.analytics_notify_event();

-- Coach replied.
drop trigger if exists analytics_notify_reply on public.email_replies;
create trigger analytics_notify_reply
  after insert on public.email_replies
  for each row
  when (new.kind = 'reply')
  execute function public.analytics_notify_event();

-- Campaign sent.
drop trigger if exists analytics_notify_campaign_sent on public.outreach_lists;
create trigger analytics_notify_campaign_sent
  after update on public.outreach_lists
  for each row
  when (old.sent_at is null and new.sent_at is not null)
  execute function public.analytics_notify_event();

-- Highlight video finished.
drop trigger if exists analytics_notify_video on public.projects;
create trigger analytics_notify_video
  after update on public.projects
  for each row
  when (new.status = 'downloadable' and old.status is distinct from 'downloadable')
  execute function public.analytics_notify_event();

-- Stopped at paywall: a paywall screen view 10+ minutes old with nothing after
-- it (no later event, no subscription). Runs every minute; one alert per stall.
create or replace function public.analytics_check_paywall_stalls()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  stall record;
begin
  for stall in
    select v.user_id, v.viewed_at
    from (
      select user_id, max(created_at) as viewed_at
      from public.product_events
      where name = 'onboarding_screen_view'
        and (properties->>'screen') in ('s37_paywall', 's37c_spin_wheel', 's38_one_time_offer')
        and created_at > now() - interval '2 hours'
      group by user_id
    ) v
    where v.viewed_at <= now() - interval '10 minutes'
      and not exists (
        select 1 from public.product_events later
        where later.user_id = v.user_id and later.created_at > v.viewed_at
      )
      and not exists (
        select 1 from public.user_subscriptions s
        where s.user_id = v.user_id and s.plan = 'full'
          and coalesce(s.updated_at, s.created_at) > v.viewed_at
      )
      and not exists (
        select 1 from public.analytics_notifications n
        where n.user_id = v.user_id and n.type = 'stalled' and n.created_at > v.viewed_at
      )
  loop
    perform public.analytics_notify_post(jsonb_build_object(
      'table', 'paywall_stalls',
      'op', 'INSERT',
      'record', jsonb_build_object('user_id', stall.user_id, 'viewed_at', stall.viewed_at),
      'old_record', null
    ));
  end loop;
end;
$$;

select cron.unschedule('analytics-paywall-stalls')
where exists (select 1 from cron.job where jobname = 'analytics-paywall-stalls');
select cron.schedule('analytics-paywall-stalls', '* * * * *', 'select public.analytics_check_paywall_stalls();');
