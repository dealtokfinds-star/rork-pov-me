-- 024_social_links.sql
-- Adds creator social media links to profiles.
-- Shape: {"twitter": "handle-or-url", "instagram": "...", "tiktok": "...",
--         "youtube": "...", "website": "https://..."}
-- Editable only by the profile owner (covered by profiles_update_self RLS).

alter table public.profiles
  add column if not exists social_links jsonb not null default '{}'::jsonb;

comment on column public.profiles.social_links is
  'Creator external links: twitter, instagram, tiktok, youtube, website';
