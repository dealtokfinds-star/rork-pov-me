-- 006_tips.sql
-- Tips sent to creators (via episodes or live streams).

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  fan_id text not null references public.profiles(id) on delete cascade,
  creator_id text not null references public.profiles(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  stream_id uuid references public.live_streams(id) on delete cascade,
  amount numeric not null,
  message text,
  status text default 'completed',
  creator_payout numeric,
  platform_fee numeric,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz default now()
);

create index if not exists idx_tips_creator on public.tips(creator_id);
create index if not exists idx_tips_fan on public.tips(fan_id);
create index if not exists idx_tips_episode on public.tips(episode_id);
create index if not exists idx_tips_stream on public.tips(stream_id);
