-- 009_dm_threads.sql
-- DM threads between fans and creators, including paid messages.

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references public.profiles(id) on delete cascade,
  fan_id text not null references public.profiles(id) on delete cascade,
  fan_unread_count integer default 0,
  creator_unread_count integer default 0,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  unique(creator_id, fan_id)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id text not null references public.profiles(id) on delete cascade,
  text text,
  attachment_url text,
  is_paid boolean default false,
  price numeric default 0,
  unlocked_by_recipient boolean default false,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz default now()
);

create index if not exists idx_dm_threads_creator on public.dm_threads(creator_id);
create index if not exists idx_dm_threads_fan on public.dm_threads(fan_id);
create index if not exists idx_dm_messages_thread on public.dm_messages(thread_id, created_at);
