-- 003_live_streams.sql
-- Live streams provisioned via Mux Live.

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled stream',
  thumb_url text,
  category text not null default 'global',
  access text not null default 'public', -- public | subscribers | ppv
  ppv_price numeric,
  viewers integer default 0,
  max_viewers integer default 0,
  is_live boolean default false,
  started_at timestamptz,
  ended_at timestamptz,
  replay_enabled boolean default false,
  replay_episode_id uuid,
  -- Mux fields
  mux_live_stream_id text,
  mux_asset_id text,
  mux_playback_id text,
  mux_playback_signing_key text,
  hls_playback_url text,
  rtmp_ingest_url text,
  rtmp_stream_key text,
  latency_mode text,
  stream_source text,
  -- Chat settings
  slow_mode boolean default false,
  sub_only_chat boolean default false,
  -- Health metrics
  health_status text,
  peak_bitrate_kbps integer,
  dropped_frames_pct numeric,
  -- Co-streaming
  is_co_stream boolean default false,
  primary_stream_id uuid,
  co_host_ids text[] default '{}'
);

create index if not exists idx_live_streams_creator on public.live_streams(creator_id);
create index if not exists idx_live_streams_is_live on public.live_streams(is_live) where is_live = true;
create index if not exists idx_live_streams_viewers on public.live_streams(viewers desc);
