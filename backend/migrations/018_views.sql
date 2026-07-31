-- 018_views.sql
-- Database views for aggregated reads.

-- active_streams: live streams that are currently broadcasting (secrets excluded)
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

-- creator_stats: per-creator aggregate metrics
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

-- episode_performance: per-episode aggregate metrics
create or replace view public.episode_performance as
select
  e.id as episode_id,
  e.creator_id,
  coalesce(e.views, 0) as total_views,
  coalesce(e.likes, 0) as total_likes,
  coalesce(e.tips, 0) as total_tips,
  (select count(*) from public.unlocks u where u.episode_id = e.id and u.status = 'completed') as total_unlocks
from public.episodes e;

-- creator_revenue_daily: daily revenue breakdown per creator
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

-- platform_revenue: daily platform-wide revenue
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
