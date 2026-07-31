-- 004_subscriptions.sql
-- Fan → creator subscriptions. Created by the payment webhook.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  price numeric not null default 9.99,
  active boolean default true,
  status text, -- active | canceled | past_due | trialing
  started_at timestamptz default now(),
  renews_at timestamptz,
  canceled_at timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_price_id text,
  unique(creator_id, fan_id)
);

create index if not exists idx_subscriptions_fan on public.subscriptions(fan_id) where active = true;
create index if not exists idx_subscriptions_creator on public.subscriptions(creator_id) where active = true;
