-- 015_email_log.sql
-- Transactional email log (sent via Resend).

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  to_email text not null,
  subject text not null,
  template text,
  status text default 'sent', -- sent | failed
  resend_id text,
  error text,
  created_at timestamptz default now()
);

create index if not exists idx_email_log_user on public.email_log(user_id);
create index if not exists idx_email_log_created on public.email_log(created_at desc);
