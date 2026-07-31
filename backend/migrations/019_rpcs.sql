-- 019_rpcs.sql
-- Stored procedures / RPCs.

-- user_id(): returns the authenticated user's id from the JWT
-- Return type is text because profiles.id is text (Rork Auth user IDs are strings)
-- Already exists in the live DB with correct text return type; create or replace is safe.
create or replace function public.user_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')
  )
$$;

-- bump_stream_viewers: atomically update viewer count
create or replace function public.bump_stream_viewers(p_stream_id uuid, p_viewers integer)
returns void
language plpgsql
security definer
as $$
begin
  update public.live_streams
  set viewers = p_viewers,
      max_viewers = greatest(coalesce(max_viewers, 0), p_viewers)
  where id = p_stream_id;
end;
$$;

-- end_stream: mark a stream as ended
create or replace function public.end_stream(p_stream_id uuid, p_replay_episode_id uuid default null)
returns void
language plpgsql
security definer
as $$
begin
  update public.live_streams
  set is_live = false,
      ended_at = now(),
      replay_episode_id = p_replay_episode_id
  where id = p_stream_id;
end;
$$;

-- bump_dm_thread: update last_message_at + unread counts
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
