-- 001_profiles.sql
-- User profile/account table. One row per signed-in user (id = auth user id).

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  handle text unique,
  avatar_url text,
  cover_url text,
  bio text,
  identity text,
  location text,
  categories text[] default '{}',
  interests text[] default '{}',
  is_creator boolean default false,
  is_admin boolean default false,
  onboarded boolean default false,
  verified boolean default false,
  -- KYC / verification
  kyc_status text default 'unverified',
  kyc_submitted_at timestamptz,
  kyc_verified_at timestamptz,
  kyc_reviewed_at timestamptz,
  kyc_reviewed_by uuid,
  kyc_last_reason text,
  kyc_session_id text,
  kyc_session_url text,
  kyc_documents jsonb,
  -- Wallet
  wallet_balance numeric default 0,
  total_spent numeric default 0,
  -- Creator payout settings
  sub_price numeric default 9.99,
  payout_connected boolean default false,
  payout_method text,
  payout_handle text,
  payout_network text,
  payout_address text,
  payout_country text,
  payout_paypal_email text,
  payout_bank_account_holder text,
  payout_bank_account_last4 text,
  payout_bank_routing text,
  payout_bank_country text,
  payout_label text,
  payout_account_name text,
  payout_account_last4 text,
  payout_balance numeric default 0,
  pending_payout numeric default 0,
  lifetime_earnings numeric default 0,
  last_payout_at timestamptz,
  -- Stripe Connect
  stripe_account_id text,
  stripe_account_status text,
  stripe_payouts_enabled boolean default false,
  stripe_onboarding_url text,
  stripe_customer_id text,
  -- Legal
  legal_name text,
  date_of_birth text,
  agreed_to_terms_at timestamptz,
  -- Full-text search
  fts tsvector,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for creator listing queries
create index if not exists idx_profiles_is_creator on public.profiles(is_creator) where is_creator = true;
create index if not exists idx_profiles_handle on public.profiles(handle);
create index if not exists idx_profiles_fts on public.profiles using gin(fts);

-- Auto-update fts on insert/update
create or replace function public.update_profile_fts() returns trigger as $$
begin
  new.fts = to_tsvector('english', coalesce(new.name, '') || ' ' || coalesce(new.handle, '') || ' ' || coalesce(new.bio, '') || ' ' || coalesce(new.identity, ''));
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_fts_trigger before insert or update on public.profiles
  for each row execute function public.update_profile_fts();
