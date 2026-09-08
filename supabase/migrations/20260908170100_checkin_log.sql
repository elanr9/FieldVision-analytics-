-- Handoff 3 step 3: log of weekly check-in texts the founder opened in Messages.
create table if not exists public.checkin_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sent_at timestamptz not null default now(),
  variation int not null
);

create index if not exists checkin_log_user_id_sent_at_idx
  on public.checkin_log (user_id, sent_at desc);

alter table public.checkin_log enable row level security;
