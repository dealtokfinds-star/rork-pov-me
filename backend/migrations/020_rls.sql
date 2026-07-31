-- 020_rls.sql
-- Row-Level Security policies for every table.

alter table public.profiles enable row level security;
alter table public.episodes enable row level security;
alter table public.live_streams enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.tips enable row level security;
alter table public.unlocks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.events enable row level security;
alter table public.reports enable row level security;
alter table public.payouts enable row level security;
alter table public.payout_requests enable row level security;
alter table public.categories enable row level security;
alter table public.push_tokens enable row level security;
alter table public.email_log enable row level security;
alter table public.verification_docs enable row level security;
alter table public.audit_logs enable row level security;

-- ─── profiles ───
-- Users can read/update their own row; public can read creator profiles.
create policy "profiles_select_self" on public.profiles for select using (auth.uid() = id);
create policy "profiles_select_public" on public.profiles for select using (is_creator = true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid() = id);

-- ─── episodes ───
-- Creators can CRUD their own; public can read published episodes.
-- NOTE: video_url is included in the public select but access is enforced
-- server-side via the episode-access edge function (which checks subscriptions/
-- unlocks before returning the URL). For stricter RLS, a column-level GRANT
-- could restrict video_url to the creator only; we rely on signed Mux URLs
-- that expire as the primary protection.
create policy "episodes_select_public" on public.episodes for select using (status = 'published' or auth.uid() = creator_id);
create policy "episodes_insert_creator" on public.episodes for insert with check (auth.uid() = creator_id);
create policy "episodes_update_creator" on public.episodes for update using (auth.uid() = creator_id);
create policy "episodes_delete_creator" on public.episodes for delete using (auth.uid() = creator_id);

-- ─── live_streams ───
-- Creators can CRUD their own; public reads via active_streams view.
create policy "live_streams_select_public" on public.live_streams for select using (true);
create policy "live_streams_insert_creator" on public.live_streams for insert with check (auth.uid() = creator_id);
create policy "live_streams_update_creator" on public.live_streams for update using (auth.uid() = creator_id);
create policy "live_streams_delete_creator" on public.live_streams for delete using (auth.uid() = creator_id);

-- ─── subscriptions ───
-- Fans read their own; creators can see who subs to them.
create policy "subs_select_fan" on public.subscriptions for select using (auth.uid() = fan_id or auth.uid() = creator_id);
create policy "subs_insert_fan" on public.subscriptions for insert with check (auth.uid() = fan_id);

-- ─── transactions ───
-- Users read their own; creators can see transactions where they're the creator.
create policy "tx_select_user" on public.transactions for select using (auth.uid() = user_id or auth.uid() = creator_id);
create policy "tx_insert_user" on public.transactions for insert with check (auth.uid() = user_id);

-- ─── tips ───
create policy "tips_select" on public.tips for select using (auth.uid() = fan_id or auth.uid() = creator_id);
create policy "tips_insert_fan" on public.tips for insert with check (auth.uid() = fan_id);

-- ─── unlocks ───
create policy "unlocks_select_fan" on public.unlocks for select using (auth.uid() = fan_id or auth.uid() = creator_id);
create policy "unlocks_insert_fan" on public.unlocks for insert with check (auth.uid() = fan_id);

-- ─── chat_messages ───
-- Authenticated users can read chat for any stream; inserts go through
-- the chat-send edge function (which enforces slow-mode + sub-only).
create policy "chat_select_auth" on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "chat_insert_auth" on public.chat_messages for insert with check (auth.uid() = user_id);

-- ─── dm_threads / dm_messages ───
create policy "dm_threads_select" on public.dm_threads for select using (auth.uid() = fan_id or auth.uid() = creator_id);
create policy "dm_threads_insert" on public.dm_threads for insert with check (auth.uid() = fan_id or auth.uid() = creator_id);
create policy "dm_messages_select" on public.dm_messages for select using (
  auth.uid() = sender_id or
  exists (select 1 from public.dm_threads t where t.id = thread_id and (t.fan_id = auth.uid() or t.creator_id = auth.uid()))
);
create policy "dm_messages_insert" on public.dm_messages for insert with check (auth.uid() = sender_id);

-- ─── events ───
-- Users read events about themselves; creators read events about their content.
create policy "events_select" on public.events for select using (auth.uid() = user_id or auth.uid() = creator_id);
create policy "events_insert" on public.events for insert with check (auth.uid() = user_id);

-- ─── reports ───
-- Users can create reports; admins can read all.
create policy "reports_insert" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_reporter" on public.reports for select using (auth.uid() = reporter_id);
-- Admin read policy: uses a subquery check (admin check done at app level too)
create policy "reports_select_admin" on public.reports for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ─── payouts / payout_requests ───
create policy "payouts_select_creator" on public.payouts for select using (auth.uid() = creator_id);
create policy "payout_requests_select_creator" on public.payout_requests for select using (auth.uid() = creator_id);
create policy "payout_requests_insert_creator" on public.payout_requests for insert with check (auth.uid() = creator_id);

-- ─── categories ───
-- Public read (everyone can see the category list).
create policy "categories_select_all" on public.categories for select using (true);

-- ─── push_tokens ───
create policy "push_tokens_select_self" on public.push_tokens for select using (auth.uid() = user_id);
create policy "push_tokens_insert_self" on public.push_tokens for insert with check (auth.uid() = user_id);
create policy "push_tokens_update_self" on public.push_tokens for update using (auth.uid() = user_id);
create policy "push_tokens_delete_self" on public.push_tokens for delete using (auth.uid() = user_id);

-- ─── email_log ───
create policy "email_log_select_self" on public.email_log for select using (auth.uid() = user_id);

-- ─── verification_docs ───
create policy "verification_docs_select_self" on public.verification_docs for select using (auth.uid() = user_id);
create policy "verification_docs_insert_self" on public.verification_docs for insert with check (auth.uid() = user_id);

-- ─── audit_logs ───
-- Admin-only read; inserts happen server-side via the edge function.
create policy "audit_logs_select_admin" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

-- ─── Views ───
-- Views inherit RLS from their base tables; no separate policy needed.
