-- 017_audit_logs.sql
-- Audit trail for sensitive admin actions. Every admin-actions edge function
-- call inserts a row here.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null, -- suspend_user | reinstate_user | hold_payout | resolve_report | approve_creator | reject_creator | fulfill_payout | set_admin | delete_episode | delete_stream | feature_episode | assign_report
  target_id text, -- the user_id / report_id / episode_id / stream_id / payout_id
  reason text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_logs_admin on public.audit_logs(admin_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
