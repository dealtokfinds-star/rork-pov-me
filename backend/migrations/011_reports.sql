-- 011_reports.sql
-- User-reported content / moderation queue.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null,
  target_type text not null, -- episode | stream | user | chat_message
  target_user_id uuid references public.profiles(id),
  reason text not null,
  details text,
  status text default 'open', -- open | investigating | resolved | dismissed
  resolution text,
  assigned_admin_id uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_target on public.reports(target_type, target_id);
