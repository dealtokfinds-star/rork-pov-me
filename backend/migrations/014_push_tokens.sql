-- 014_push_tokens.sql
-- Push notification token registration.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text, -- ios | android | web
  app_version text,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, token)
);

create index if not exists idx_push_tokens_user on public.push_tokens(user_id);
create index if not exists idx_push_tokens_token on public.push_tokens(token);
