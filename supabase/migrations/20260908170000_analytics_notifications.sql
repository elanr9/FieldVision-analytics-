-- Handoff 3 step 2: persisted product events for the Activity feed.
create table if not exists public.analytics_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  user_id uuid not null,
  title text not null,
  sub text null
);

create index if not exists analytics_notifications_created_at_idx
  on public.analytics_notifications (created_at desc);

alter table public.analytics_notifications enable row level security;
