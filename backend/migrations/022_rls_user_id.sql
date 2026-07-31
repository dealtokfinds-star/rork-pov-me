-- 022_rls_user_id.sql
-- Replace all auth.uid()-based RLS policies with public.user_id().
--
-- Supabase's built-in auth.uid() casts the JWT `sub` claim to uuid internally
-- ( ...sub')::uuid ), which throws "invalid input syntax for type uuid" for
-- Rork Auth string IDs like "usr_5tjn4m2iakyd3v19zb0xy81d".
-- The public.user_id() function returns the raw `sub` as text (no uuid cast),
-- so all policies must use it instead of auth.uid()::text.

-- ─── Drop every policy that uses auth.uid() ───
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "episodes_select_public" on public.episodes;
drop policy if exists "episodes_insert_creator" on public.episodes;
drop policy if exists "episodes_update_creator" on public.episodes;
drop policy if exists "episodes_delete_creator" on public.episodes;
drop policy if exists "live_streams_select_public" on public.live_streams;
drop policy if exists "live_streams_insert_creator" on public.live_streams;
drop policy if exists "live_streams_update_creator" on public.live_streams;
drop policy if exists "live_streams_delete_creator" on public.live_streams;
drop policy if exists "subs_select_fan" on public.subscriptions;
drop policy if exists "subs_insert_fan" on public.subscriptions;
drop policy if exists "tx_select_user" on public.transactions;
drop policy if exists "tx_insert_user" on public.transactions;
drop policy if exists "tips_select" on public.tips;
drop policy if exists "tips_insert_fan" on public.tips;
drop policy if exists "unlocks_select_fan" on public.unlocks;
drop policy if exists "unlocks_insert_fan" on public.unlocks;
drop policy if exists "chat_select_auth" on public.chat_messages;
drop policy if exists "chat_insert_auth" on public.chat_messages;
drop policy if exists "dm_threads_select" on public.dm_threads;
drop policy if exists "dm_threads_insert" on public.dm_threads;
drop policy if exists "dm_messages_select" on public.dm_messages;
drop policy if exists "dm_messages_insert" on public.dm_messages;
drop policy if exists "events_select" on public.events;
drop policy if exists "events_insert" on public.events;
drop policy if exists "reports_insert" on public.reports;
drop policy if exists "reports_select_reporter" on public.reports;
drop policy if exists "reports_select_admin" on public.reports;
drop policy if exists "payouts_select_creator" on public.payouts;
drop policy if exists "payout_requests_select_creator" on public.payout_requests;
drop policy if exists "payout_requests_insert_creator" on public.payout_requests;
drop policy if exists "push_tokens_select_self" on public.push_tokens;
drop policy if exists "push_tokens_insert_self" on public.push_tokens;
drop policy if exists "push_tokens_update_self" on public.push_tokens;
drop policy if exists "push_tokens_delete_self" on public.push_tokens;
drop policy if exists "email_log_select_self" on public.email_log;
drop policy if exists "verification_docs_select_self" on public.verification_docs;
drop policy if exists "verification_docs_insert_self" on public.verification_docs;
drop policy if exists "audit_logs_select_admin" on public.audit_logs;

-- ─── Recreate with public.user_id() (returns text, no uuid cast) ───
create policy "profiles_select_self" on public.profiles for select using (user_id() = id);
create policy "profiles_insert_self" on public.profiles for insert with check (user_id() = id);
create policy "profiles_update_self" on public.profiles for update using (user_id() = id);

create policy "episodes_select_public" on public.episodes for select using (status = 'published' or user_id() = creator_id);
create policy "episodes_insert_creator" on public.episodes for insert with check (user_id() = creator_id);
create policy "episodes_update_creator" on public.episodes for update using (user_id() = creator_id);
create policy "episodes_delete_creator" on public.episodes for delete using (user_id() = creator_id);

create policy "live_streams_select_public" on public.live_streams for select using (true);
create policy "live_streams_insert_creator" on public.live_streams for insert with check (user_id() = creator_id);
create policy "live_streams_update_creator" on public.live_streams for update using (user_id() = creator_id);
create policy "live_streams_delete_creator" on public.live_streams for delete using (user_id() = creator_id);

create policy "subs_select_fan" on public.subscriptions for select using (user_id() = fan_id or user_id() = creator_id);
create policy "subs_insert_fan" on public.subscriptions for insert with check (user_id() = fan_id);

create policy "tx_select_user" on public.transactions for select using (user_id() = transactions.user_id or user_id() = creator_id);
create policy "tx_insert_user" on public.transactions for insert with check (user_id() = transactions.user_id);

create policy "tips_select" on public.tips for select using (user_id() = fan_id or user_id() = creator_id);
create policy "tips_insert_fan" on public.tips for insert with check (user_id() = fan_id);

create policy "unlocks_select_fan" on public.unlocks for select using (
  user_id() = fan_id or
  exists (select 1 from public.episodes e where e.id = unlocks.episode_id and e.creator_id = user_id())
);
create policy "unlocks_insert_fan" on public.unlocks for insert with check (user_id() = fan_id);

create policy "chat_select_auth" on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "chat_insert_auth" on public.chat_messages for insert with check (user_id() = chat_messages.user_id);

create policy "dm_threads_select" on public.dm_threads for select using (user_id() = fan_id or user_id() = creator_id);
create policy "dm_threads_insert" on public.dm_threads for insert with check (user_id() = fan_id or user_id() = creator_id);

create policy "dm_messages_select" on public.dm_messages for select using (
  user_id() = sender_id or
  exists (select 1 from public.dm_threads t where t.id = dm_messages.thread_id and (t.fan_id = user_id() or t.creator_id = user_id()))
);
create policy "dm_messages_insert" on public.dm_messages for insert with check (user_id() = sender_id);

create policy "events_select" on public.events for select using (user_id() = events.user_id or user_id() = creator_id);
create policy "events_insert" on public.events for insert with check (user_id() = events.user_id);

create policy "reports_insert" on public.reports for insert with check (user_id() = reporter_id);
create policy "reports_select_reporter" on public.reports for select using (user_id() = reporter_id);
create policy "reports_select_admin" on public.reports for select using (
  exists (select 1 from public.profiles p where p.id = user_id() and p.is_admin = true)
);

create policy "payouts_select_creator" on public.payouts for select using (user_id() = creator_id);
create policy "payout_requests_select_creator" on public.payout_requests for select using (user_id() = creator_id);
create policy "payout_requests_insert_creator" on public.payout_requests for insert with check (user_id() = creator_id);

create policy "push_tokens_select_self" on public.push_tokens for select using (user_id() = push_tokens.user_id);
create policy "push_tokens_insert_self" on public.push_tokens for insert with check (user_id() = push_tokens.user_id);
create policy "push_tokens_update_self" on public.push_tokens for update using (user_id() = push_tokens.user_id);
create policy "push_tokens_delete_self" on public.push_tokens for delete using (user_id() = push_tokens.user_id);

create policy "email_log_select_self" on public.email_log for select using (user_id() = email_log.user_id);

create policy "verification_docs_select_self" on public.verification_docs for select using (user_id() = verification_docs.user_id);
create policy "verification_docs_insert_self" on public.verification_docs for insert with check (user_id() = verification_docs.user_id);

create policy "audit_logs_select_admin" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = user_id() and p.is_admin = true)
);
