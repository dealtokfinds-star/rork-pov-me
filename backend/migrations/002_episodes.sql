-- 002_episodes.sql
-- VOD episodes uploaded by creators. Video is processed by Mux.

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  description text,
  thumb_url text,
  video_url text,
  duration_sec integer,
  access text not null default 'free', -- free | subscribers | ppv
  ppv_price numeric,
  category text not null default 'global',
  chapter text,
  status text not null default 'draft', -- draft | uploading | transcoding | published | scheduled | failed
  views integer default 0,
  likes integer default 0,
  tips numeric default 0,
  mux_asset_id text,
  mux_upload_id text,
  posted_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_episodes_creator on public.episodes(creator_id);
create index if not exists idx_episodes_status on public.episodes(status);
create index if not exists idx_episodes_category on public.episodes(category);
create index if not exists idx_episodes_posted on public.episodes(posted_at desc);
