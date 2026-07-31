-- Migration 023: Convert profiles.categories and interests from text[] to jsonb
--
-- The Supabase JS client sends JS arrays as JSON, which PostgREST interprets
-- as jsonb. The columns were originally text[] (Postgres native arrays),
-- causing "column is of type text[] but expression is of type jsonb" errors
-- on every update that includes categories (e.g. publishCreatorProfile).
--
-- Converting to jsonb makes the Supabase JS client work seamlessly, and
-- jsonb arrays are more flexible for querying. The creator_stats view is
-- dropped and recreated because it depends on the categories column.

-- 1. Drop the view that depends on categories
drop view if exists public.creator_stats cascade;

-- 2. Convert categories: text[] -> jsonb
alter table public.profiles alter column categories drop default;
alter table public.profiles alter column categories type jsonb using to_jsonb(categories);
alter table public.profiles alter column categories set default '[]'::jsonb;

-- 3. Convert interests: text[] -> jsonb
alter table public.profiles alter column interests drop default;
alter table public.profiles alter column interests type jsonb using to_jsonb(interests);
alter table public.profiles alter column interests set default '[]'::jsonb;

-- 4. Recreate the creator_stats view
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
