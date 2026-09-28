-- Conversion tab: persisted AI outputs (diagnosis, case reads, repo prompts) so a model call
-- happens once per change in the data instead of once per serverless instance.
create table if not exists public.analytics_ai_cache (
  key text primary key,
  value jsonb not null,
  fingerprint text,
  updated_at timestamptz not null default now()
);

alter table public.analytics_ai_cache enable row level security;
