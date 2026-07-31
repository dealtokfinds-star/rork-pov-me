-- 012_payouts.sql
-- Payout records (completed) + payout requests (pending admin fulfillment).

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  currency text default 'USD',
  method text, -- paypal | bank | stripe
  status text default 'pending', -- pending | paid | failed
  stripe_payout_id text,
  stripe_transfer_id text,
  requested_at timestamptz default now(),
  processed_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  payout_method text,
  payout_handle text,
  payout_address text,
  payout_network text,
  status text default 'pending', -- pending | approved | paid | rejected
  admin_note text,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id),
  requested_at timestamptz default now()
);

create index if not exists idx_payouts_creator on public.payouts(creator_id);
create index if not exists idx_payout_requests_creator on public.payout_requests(creator_id);
create index if not exists idx_payout_requests_status on public.payout_requests(status);
