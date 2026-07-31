-- 007_unlocks.sql
-- PPV unlocks — a fan pays once to unlock an episode or stream.

create table if not exists public.unlocks (
  id uuid primary key default gen_random_uuid(),
  fan_id text not null references public.profiles(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  stream_id uuid references public.live_streams(id) on delete cascade,
  price numeric not null,
  status text default 'completed',
  creator_payout numeric,
  platform_fee numeric,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz default now()
);

create index if not exists idx_unlocks_fan on public.unlocks(fan_id);
create index if not exists idx_unlocks_episode on public.unlocks(episode_id);
create index if not exists idx_unlocks_stream on public.unlocks(stream_id);
