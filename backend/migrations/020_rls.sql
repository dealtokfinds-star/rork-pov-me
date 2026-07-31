-- 020_rls.sql
-- Row-Level Security policies for every table.
-- NOTE: auth.uid() returns uuid, but all user-id columns are text (Rork Auth uses
-- string IDs). We cast auth.uid()::text in every policy to avoid uuid=text errors.

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
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select using (auth.uid()::text = id);
create policy "profiles_select_public" on public.profiles for select using (is_creator = true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid()::text = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid()::text = id);

-- ─── episodes ───
-- Creators can CRUD their own; public can read published episodes.
-- NOTE: video_url is included in the public select but access is enforced
-- server-side via the episode-access edge function (which checks subscriptions/
-- unlocks before returning the URL). For stricter RLS, a column-level GRANT
-- could restrict video_url to the creator only; we rely on signed Mux URLs
-- that expire as the primary protection.
drop policy if exists "episodes_select_public" on public.episodes;
drop policy if exists "episodes_insert_creator" on public.episodes;
drop policy if exists "episodes_update_creator" on public.episodes;
drop policy if exists "episodes_delete_creator" on public.episodes;
create policy "episodes_select_public" on public.episodes for select using (status = 'published' or auth.uid()::text = creator_id);
create policy "episodes_insert_creator" on public.episodes for insert with check (auth.uid()::text = creator_id);
create policy "episodes_update_creator" on public.episodes for update using (auth.uid()::text = creator_id);
create policy "episodes_delete_creator" on public.episodes for delete using (auth.uid()::text = creator_id);

-- ─── live_streams ───
-- Creators can CRUD their own; public reads via active_streams view.
drop policy if exists "live_streams_select_public" on public.live_streams;
drop policy if exists "live_streams_insert_creator" on public.live_streams;
drop policy if exists "live_streams_update_creator" on public.live_streams;
drop policy if exists "live_streams_delete_creator" on public.live_streams;
create policy "live_streams_select_public" on public.live_streams for select using (true);
create policy "live_streams_insert_creator" on public.live_streams for insert with check (auth.uid()::text = creator_id);
create policy "live_streams_update_creator" on public.live_streams for update using (auth.uid()::text = creator_id);
create policy "live_streams_delete_creator" on public.live_streams for delete using (auth.uid()::text = creator_id);

-- ─── subscriptions ───
-- Fans read their own; creators can see who subs to them.
drop policy if exists "subs_select_fan" on public.subscriptions;
drop policy if exists "subs_insert_fan" on public.subscriptions;
create policy "subs_select_fan" on public.subscriptions for select using (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "subs_insert_fan" on public.subscriptions for insert with check (auth.uid()::text = fan_id);

-- ─── transactions ───
-- Users read their own; creators can see transactions where they're the creator.
drop policy if exists "tx_select_user" on public.transactions;
drop policy if exists "tx_insert_user" on public.transactions;
create policy "tx_select_user" on public.transactions for select using (auth.uid()::text = user_id or auth.uid()::text = creator_id);
create policy "tx_insert_user" on public.transactions for insert with check (auth.uid()::text = user_id);

-- ─── tips ───
drop policy if exists "tips_select" on public.tips;
drop policy if exists "tips_insert_fan" on public.tips;
create policy "tips_select" on public.tips for select using (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "tips_insert_fan" on public.tips for insert with check (auth.uid()::text = fan_id);

-- ─── unlocks ───
drop policy if exists "unlocks_select_fan" on public.unlocks;
drop policy if exists "unlocks_insert_fan" on public.unlocks;
-- unlocks has fan_id but no creator_id column; join to episodes for creator access
create policy "unlocks_select_fan" on public.unlocks for select using (
  auth.uid()::text = fan_id or
  exists (select 1 from public.episodes e where e.id = unlocks.episode_id and e.creator_id = auth.uid()::text)
);
create policy "unlocks_insert_fan" on public.unlocks for insert with check (auth.uid()::text = fan_id);

-- ─── chat_messages ───
-- Authenticated users can read chat for any stream; inserts go through
-- the chat-send edge function (which enforces slow-mode + sub-only).
drop policy if exists "chat_select_auth" on public.chat_messages;
drop policy if exists "chat_insert_auth" on public.chat_messages;
create policy "chat_select_auth" on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "chat_insert_auth" on public.chat_messages for insert with check (auth.uid()::text = user_id);

-- ─── dm_threads / dm_messages ───
drop policy if exists "dm_threads_select" on public.dm_threads;
drop policy if exists "dm_threads_insert" on public.dm_threads;
drop policy if exists "dm_messages_select" on public.dm_messages;
drop policy if exists "dm_messages_insert" on public.dm_messages;
create policy "dm_threads_select" on public.dm_threads for select using (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "dm_threads_insert" on public.dm_threads for insert with check (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "dm_messages_select" on public.dm_messages for select using (
  auth.uid()::text = sender_id or
  exists (select 1 from public.dm_threads t where t.id = thread_id and (t.fan_id = auth.uid()::text or t.creator_id = auth.uid()::text))
);
create policy "dm_messages_insert" on public.dm_messages for insert with check (auth.uid()::text = sender_id);

-- ─── events ───
-- Users read events about themselves; creators read events about their content.
drop policy if exists "events_select" on public.events;
drop policy if exists "events_insert" on public.events;
create policy "events_select" on public.events for select using (auth.uid()::text = user_id or auth.uid()::text = creator_id);
create policy "events_insert" on public.events for insert with check (auth.uid()::text = user_id);

-- ─── reports ───
-- Users can create reports; admins can read all.
drop policy if exists "reports_insert" on public.reports;
drop policy if exists "reports_select_reporter" on public.reports;
drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_insert" on public.reports for insert with check (auth.uid()::text = reporter_id);
create policy "reports_select_reporter" on public.reports for select using (auth.uid()::text = reporter_id);
-- Admin read policy: uses a subquery check (admin check done at app level too)
create policy "reports_select_admin" on public.reports for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.is_admin = true)
);

-- ─── payouts / payout_requests ───
drop policy if exists "payouts_select_creator" on public.payouts;
drop policy if exists "payout_requests_select_creator" on public.payout_requests;
drop policy if exists "payout_requests_insert_creator" on public.payout_requests;
create policy "payouts_select_creator" on public.payouts for select using (auth.uid()::text = creator_id);
create policy "payout_requests_select_creator" on public.payout_requests for select using (auth.uid()::text = creator_id);
create policy "payout_requests_insert_creator" on public.payout_requests for insert with check (auth.uid()::text = creator_id);

-- ─── categories ───
-- Public read (everyone can see the category list).
drop policy if exists "categories_select_all" on public.categories;
create policy "categories_select_all" on public.categories for select using (true);

-- ─── push_tokens ───
drop policy if exists "push_tokens_select_self" on public.push_tokens;
drop policy if exists "push_tokens_insert_self" on public.push_tokens;
drop policy if exists "push_tokens_update_self" on public.push_tokens;
drop policy if exists "push_tokens_delete_self" on public.push_tokens;
create policy "push_tokens_select_self" on public.push_tokens for select using (auth.uid()::text = user_id);
create policy "push_tokens_insert_self" on public.push_tokens for insert with check (auth.uid()::text = user_id);
create policy "push_tokens_update_self" on public.push_tokens for update using (auth.uid()::text = user_id);
create policy "push_tokens_delete_self" on public.push_tokens for delete using (auth.uid()::text = user_id);

-- ─── email_log ───
drop policy if exists "email_log_select_self" on public.email_log;
create policy "email_log_select_self" on public.email_log for select using (auth.uid()::text = user_id);

-- ─── verification_docs ───
drop policy if exists "verification_docs_select_self" on public.verification_docs;
drop policy if exists "verification_docs_insert_self" on public.verification_docs;
create policy "verification_docs_select_self" on public.verification_docs for select using (auth.uid()::text = user_id);
create policy "verification_docs_insert_self" on public.verification_docs for insert with check (auth.uid()::text = user_id);

-- ─── audit_logs ───
-- Admin-only read; inserts happen server-side via the edge function.
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.is_admin = true)
);

-- ─── Views ───
-- Views inherit RLS from their base tables; no separate policy needed.
