-- 10 minutes before a booked call, post to /api/notify so Elan gets a
-- reminder push that opens that user's profile. Booking alerts stay on
-- founder_calls insert (trigger added here if the table exists).

create or replace function public.analytics_notify_upcoming_call(p_user_id uuid, p_scheduled_at timestamptz)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_user_id is null or p_scheduled_at is null then
    return;
  end if;
  if exists (
    select 1 from public.analytics_notifications n
    where n.user_id = p_user_id
      and n.type = 'call_soon'
      and n.created_at > p_scheduled_at - interval '20 minutes'
      and n.created_at < p_scheduled_at + interval '5 minutes'
  ) then
    return;
  end if;
  perform public.analytics_notify_post(jsonb_build_object(
    'table', 'upcoming_calls',
    'op', 'INSERT',
    'record', jsonb_build_object('user_id', p_user_id, 'scheduled_at', p_scheduled_at),
    'old_record', null
  ));
end;
$$;

create or replace function public.analytics_check_upcoming_calls()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec record;
begin
  if to_regclass('public.founder_calls') is not null then
    begin
      for rec in
        execute $q$
          select user_id, scheduled_at
          from public.founder_calls
          where scheduled_at > now()
            and scheduled_at <= now() + interval '10 minutes'
        $q$
      loop
        perform public.analytics_notify_upcoming_call(rec.user_id, rec.scheduled_at);
      end loop;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.ambassador_bookings') is not null then
    begin
      for rec in
        execute $q$
          select student_user_id as user_id, start_at as scheduled_at
          from public.ambassador_bookings
          where start_at > now()
            and start_at <= now() + interval '10 minutes'
            and coalesce(status, '') not in ('cancelled', 'canceled', 'no_show')
        $q$
      loop
        perform public.analytics_notify_upcoming_call(rec.user_id, rec.scheduled_at);
      end loop;
    exception when others then
      null;
    end;
  end if;
end;
$$;

select cron.unschedule('analytics-upcoming-calls')
where exists (select 1 from cron.job where jobname = 'analytics-upcoming-calls');
select cron.schedule('analytics-upcoming-calls', '* * * * *', 'select public.analytics_check_upcoming_calls();');

do $$
begin
  if to_regclass('public.founder_calls') is not null then
    execute 'drop trigger if exists analytics_notify_call on public.founder_calls';
    execute 'create trigger analytics_notify_call after insert on public.founder_calls for each row execute function public.analytics_notify_event()';
  end if;
end $$;
