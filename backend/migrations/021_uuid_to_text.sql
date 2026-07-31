-- 021_uuid_to_text.sql
-- Convert all user-id columns from uuid to text.
-- Rork Auth uses string user IDs (e.g. "usr_...") that are not valid UUIDs,
-- so profiles.id and every FK referencing it must be text, not uuid.
-- Content PKs (episodes, live_streams, dm_threads, etc.) stay uuid since
-- they use gen_random_uuid().

-- ─── Drop RLS policies that reference the columns we're altering ───
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_public" on public.profiles;
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

-- ─── Drop views and RPCs that depend on these columns ───
drop view if exists public.active_streams cascade;
drop view if exists public.creator_stats cascade;
drop view if exists public.episode_performance cascade;
drop view if exists public.creator_revenue_daily cascade;
drop view if exists public.platform_revenue cascade;
drop function if exists public.bump_dm_thread(uuid, uuid);

-- ─── Drop FK constraints ───
alter table public.episodes drop constraint if exists episodes_creator_id_fkey;
alter table public.live_streams drop constraint if exists live_streams_creator_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_fan_id_fkey;
alter table public.subscriptions drop constraint if exists subscriptions_creator_id_fkey;
alter table public.transactions drop constraint if exists transactions_user_id_fkey;
alter table public.transactions drop constraint if exists transactions_creator_id_fkey;
alter table public.tips drop constraint if exists tips_fan_id_fkey;
alter table public.tips drop constraint if exists tips_creator_id_fkey;
alter table public.unlocks drop constraint if exists unlocks_fan_id_fkey;
alter table public.chat_messages drop constraint if exists chat_messages_user_id_fkey;
alter table public.dm_threads drop constraint if exists dm_threads_creator_id_fkey;
alter table public.dm_threads drop constraint if exists dm_threads_fan_id_fkey;
alter table public.dm_messages drop constraint if exists dm_messages_sender_id_fkey;
alter table public.events drop constraint if exists events_user_id_fkey;
alter table public.events drop constraint if exists events_creator_id_fkey;
alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports drop constraint if exists reports_target_user_id_fkey;
alter table public.reports drop constraint if exists reports_assigned_admin_id_fkey;
alter table public.payouts drop constraint if exists payouts_creator_id_fkey;
alter table public.payout_requests drop constraint if exists payout_requests_creator_id_fkey;
alter table public.payout_requests drop constraint if exists payout_requests_processed_by_fkey;
alter table public.push_tokens drop constraint if exists push_tokens_user_id_fkey;
alter table public.email_log drop constraint if exists email_log_user_id_fkey;
alter table public.verification_docs drop constraint if exists verification_docs_user_id_fkey;
alter table public.verification_docs drop constraint if exists verification_docs_reviewer_id_fkey;
alter table public.audit_logs drop constraint if exists audit_logs_admin_id_fkey;

-- ─── Alter profiles.id and user-id columns to text ───
alter table public.profiles alter column id type text using id::text;
alter table public.profiles alter column kyc_reviewed_by type text using kyc_reviewed_by::text;

alter table public.episodes alter column creator_id type text using creator_id::text;
alter table public.live_streams alter column creator_id type text using creator_id::text;
alter table public.subscriptions alter column fan_id type text using fan_id::text;
alter table public.subscriptions alter column creator_id type text using creator_id::text;
alter table public.transactions alter column user_id type text using user_id::text;
alter table public.transactions alter column creator_id type text using creator_id::text;
alter table public.tips alter column fan_id type text using fan_id::text;
alter table public.tips alter column creator_id type text using creator_id::text;
alter table public.unlocks alter column fan_id type text using fan_id::text;
alter table public.chat_messages alter column user_id type text using user_id::text;
alter table public.dm_threads alter column creator_id type text using creator_id::text;
alter table public.dm_threads alter column fan_id type text using fan_id::text;
alter table public.dm_messages alter column sender_id type text using sender_id::text;
alter table public.events alter column user_id type text using user_id::text;
alter table public.events alter column creator_id type text using creator_id::text;
alter table public.reports alter column reporter_id type text using reporter_id::text;
alter table public.reports alter column target_user_id type text using target_user_id::text;
alter table public.reports alter column assigned_admin_id type text using assigned_admin_id::text;
alter table public.payouts alter column creator_id type text using creator_id::text;
alter table public.payout_requests alter column creator_id type text using creator_id::text;
alter table public.payout_requests alter column processed_by type text using processed_by::text;
alter table public.push_tokens alter column user_id type text using user_id::text;
alter table public.email_log alter column user_id type text using user_id::text;
alter table public.verification_docs alter column user_id type text using user_id::text;
alter table public.verification_docs alter column reviewer_id type text using reviewer_id::text;

-- ─── Recreate FK constraints (all text now) ───
alter table public.episodes add constraint episodes_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.live_streams add constraint live_streams_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.subscriptions add constraint subscriptions_fan_id_fkey
  foreign key (fan_id) references public.profiles(id) on delete cascade;
alter table public.subscriptions add constraint subscriptions_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.transactions add constraint transactions_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.transactions add constraint transactions_creator_id_fkey
  foreign key (creator_id) references public.profiles(id);
alter table public.tips add constraint tips_fan_id_fkey
  foreign key (fan_id) references public.profiles(id) on delete cascade;
alter table public.tips add constraint tips_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.unlocks add constraint unlocks_fan_id_fkey
  foreign key (fan_id) references public.profiles(id) on delete cascade;
alter table public.chat_messages add constraint chat_messages_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.dm_threads add constraint dm_threads_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.dm_threads add constraint dm_threads_fan_id_fkey
  foreign key (fan_id) references public.profiles(id) on delete cascade;
alter table public.dm_messages add constraint dm_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;
alter table public.events add constraint events_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.events add constraint events_creator_id_fkey
  foreign key (creator_id) references public.profiles(id);
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete cascade;
alter table public.reports add constraint reports_target_user_id_fkey
  foreign key (target_user_id) references public.profiles(id);
alter table public.reports add constraint reports_assigned_admin_id_fkey
  foreign key (assigned_admin_id) references public.profiles(id);
alter table public.payouts add constraint payouts_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.payout_requests add constraint payout_requests_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete cascade;
alter table public.payout_requests add constraint payout_requests_processed_by_fkey
  foreign key (processed_by) references public.profiles(id);
alter table public.push_tokens add constraint push_tokens_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.email_log add constraint email_log_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.verification_docs add constraint verification_docs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.verification_docs add constraint verification_docs_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id);
alter table public.audit_logs add constraint audit_logs_admin_id_fkey
  foreign key (admin_id) references public.profiles(id) on delete cascade;

-- ─── Recreate bump_dm_thread with text sender_id ───
create or replace function public.bump_dm_thread(p_sender_id text, p_thread_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.dm_threads
  set last_message_at = now(),
      fan_unread_count = case when p_sender_id = creator_id then fan_unread_count + 1 else fan_unread_count end,
      creator_unread_count = case when p_sender_id = fan_id then creator_unread_count + 1 else creator_unread_count end
  where id = p_thread_id;
end;
$$;

-- ─── Recreate views ───
create or replace view public.active_streams as
select
  id, creator_id, title, thumb_url, category, access, ppv_price,
  viewers, max_viewers, is_live, started_at, ended_at,
  health_status, peak_bitrate_kbps, dropped_frames_pct,
  hls_playback_url, mux_playback_id,
  replay_enabled, replay_episode_id,
  slow_mode, sub_only_chat, latency_mode, stream_source,
  is_co_stream, primary_stream_id, co_host_ids
from public.live_streams
where is_live = true;

create or replace view public.creator_stats as
select
  p.id as creator_id,
  p.is_creator,
  p.verified,
  p.categories,
  p.sub_price,
  coalesce(ep.ep_count, 0) as ep_count,
  coalesce(ep.ep_views, 0) as ep_views,
  coalesce(ep.ep_likes, 0) as ep_likes,
  coalesce(ep.ep_tips, 0) as ep_tips,
  coalesce(s.sub_count, 0) as sub_count
from public.profiles p
left join (
  select creator_id,
    count(*) as ep_count,
    coalesce(sum(views), 0) as ep_views,
    coalesce(sum(likes), 0) as ep_likes,
    coalesce(sum(tips), 0) as ep_tips
  from public.episodes
  where status = 'published'
  group by creator_id
) ep on ep.creator_id = p.id
left join (
  select creator_id, count(*) as sub_count
  from public.subscriptions
  where active = true
  group by creator_id
) s on s.creator_id = p.id
where p.is_creator = true;

create or replace view public.episode_performance as
select
  e.id as episode_id,
  e.creator_id,
  coalesce(e.views, 0) as total_views,
  coalesce(e.likes, 0) as total_likes,
  coalesce(e.tips, 0) as total_tips,
  (select count(*) from public.unlocks u where u.episode_id = e.id and u.status = 'completed') as total_unlocks
from public.episodes e;

create or replace view public.creator_revenue_daily as
select
  creator_id,
  date_trunc('day', created_at)::date as day,
  count(*) as event_count,
  sum(case when kind = 'sub' then creator_payout else 0 end) as sub_revenue,
  sum(case when kind = 'ppv' then creator_payout else 0 end) as ppv_revenue,
  sum(case when kind in ('tip', 'gift') then creator_payout else 0 end) as tip_revenue
from public.transactions
where status = 'completed' and creator_id is not null
group by creator_id, day
order by day desc;

create or replace view public.platform_revenue as
select
  date_trunc('day', created_at)::date as day,
  kind,
  count(*) as tx_count,
  sum(amount) as gross,
  sum(platform_fee) as platform_cut,
  sum(creator_payout) as creator_cut
from public.transactions
where status = 'completed'
group by day, kind
order by day desc;

-- ─── Recreate RLS policies (now safe — columns are text) ───
create policy "profiles_select_self" on public.profiles for select using (auth.uid()::text = id);
create policy "profiles_select_public" on public.profiles for select using (is_creator = true);
create policy "profiles_insert_self" on public.profiles for insert with check (auth.uid()::text = id);
create policy "profiles_update_self" on public.profiles for update using (auth.uid()::text = id);

create policy "episodes_select_public" on public.episodes for select using (status = 'published' or auth.uid()::text = creator_id);
create policy "episodes_insert_creator" on public.episodes for insert with check (auth.uid()::text = creator_id);
create policy "episodes_update_creator" on public.episodes for update using (auth.uid()::text = creator_id);
create policy "episodes_delete_creator" on public.episodes for delete using (auth.uid()::text = creator_id);

create policy "live_streams_select_public" on public.live_streams for select using (true);
create policy "live_streams_insert_creator" on public.live_streams for insert with check (auth.uid()::text = creator_id);
create policy "live_streams_update_creator" on public.live_streams for update using (auth.uid()::text = creator_id);
create policy "live_streams_delete_creator" on public.live_streams for delete using (auth.uid()::text = creator_id);

create policy "subs_select_fan" on public.subscriptions for select using (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "subs_insert_fan" on public.subscriptions for insert with check (auth.uid()::text = fan_id);

create policy "tx_select_user" on public.transactions for select using (auth.uid()::text = user_id or auth.uid()::text = creator_id);
create policy "tx_insert_user" on public.transactions for insert with check (auth.uid()::text = user_id);

create policy "tips_select" on public.tips for select using (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "tips_insert_fan" on public.tips for insert with check (auth.uid()::text = fan_id);

create policy "unlocks_select_fan" on public.unlocks for select using (
  auth.uid()::text = fan_id or
  exists (select 1 from public.episodes e where e.id = unlocks.episode_id and e.creator_id = auth.uid()::text)
);
create policy "unlocks_insert_fan" on public.unlocks for insert with check (auth.uid()::text = fan_id);

create policy "chat_select_auth" on public.chat_messages for select using (auth.role() = 'authenticated');
create policy "chat_insert_auth" on public.chat_messages for insert with check (auth.uid()::text = user_id);

create policy "dm_threads_select" on public.dm_threads for select using (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "dm_threads_insert" on public.dm_threads for insert with check (auth.uid()::text = fan_id or auth.uid()::text = creator_id);
create policy "dm_messages_select" on public.dm_messages for select using (
  auth.uid()::text = sender_id or
  exists (select 1 from public.dm_threads t where t.id = thread_id and (t.fan_id = auth.uid()::text or t.creator_id = auth.uid()::text))
);
create policy "dm_messages_insert" on public.dm_messages for insert with check (auth.uid()::text = sender_id);

create policy "events_select" on public.events for select using (auth.uid()::text = user_id or auth.uid()::text = creator_id);
create policy "events_insert" on public.events for insert with check (auth.uid()::text = user_id);

create policy "reports_insert" on public.reports for insert with check (auth.uid()::text = reporter_id);
create policy "reports_select_reporter" on public.reports for select using (auth.uid()::text = reporter_id);
create policy "reports_select_admin" on public.reports for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.is_admin = true)
);

create policy "payouts_select_creator" on public.payouts for select using (auth.uid()::text = creator_id);
create policy "payout_requests_select_creator" on public.payout_requests for select using (auth.uid()::text = creator_id);
create policy "payout_requests_insert_creator" on public.payout_requests for insert with check (auth.uid()::text = creator_id);

create policy "categories_select_all" on public.categories for select using (true);

create policy "push_tokens_select_self" on public.push_tokens for select using (auth.uid()::text = user_id);
create policy "push_tokens_insert_self" on public.push_tokens for insert with check (auth.uid()::text = user_id);
create policy "push_tokens_update_self" on public.push_tokens for update using (auth.uid()::text = user_id);
create policy "push_tokens_delete_self" on public.push_tokens for delete using (auth.uid()::text = user_id);

create policy "email_log_select_self" on public.email_log for select using (auth.uid()::text = user_id);

create policy "verification_docs_select_self" on public.verification_docs for select using (auth.uid()::text = user_id);
create policy "verification_docs_insert_self" on public.verification_docs for insert with check (auth.uid()::text = user_id);

create policy "audit_logs_select_admin" on public.audit_logs for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid()::text and p.is_admin = true)
);
