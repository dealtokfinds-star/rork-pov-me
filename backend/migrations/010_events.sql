-- 010_events.sql
-- Analytics events (views, likes, follows, etc).

create table if not exists public.events (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid references public.profiles(id),
  episode_id uuid references public.episodes(id) on delete cascade,
  stream_id uuid references public.live_streams(id) on delete cascade,
  kind text not null, -- view | like | follow | tip | subscribe | unlock | publish | go_live
  value numeric,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_events_user on public.events(user_id);
create index if not exists idx_events_creator on public.events(creator_id);
create index if not exists idx_events_kind on public.events(kind);
create index if not exists idx_events_created on public.events(created_at desc);
