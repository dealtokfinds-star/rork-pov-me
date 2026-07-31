-- 005_transactions.sql
-- All payment transactions (top-ups, subs, PPV, tips, payouts).

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  creator_id text references public.profiles(id),
  kind text not null, -- topup | sub | ppv | tip | payout | gift
  label text not null,
  amount numeric not null,
  currency text default 'USD',
  status text default 'pending', -- pending | completed | failed | refunded
  platform_fee numeric,
  creator_payout numeric,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  created_at timestamptz default now()
);

create index if not exists idx_transactions_user on public.transactions(user_id);
create index if not exists idx_transactions_creator on public.transactions(creator_id);
create index if not exists idx_transactions_status on public.transactions(status);
create index if not exists idx_transactions_kind on public.transactions(kind);
create index if not exists idx_transactions_created on public.transactions(created_at desc);
