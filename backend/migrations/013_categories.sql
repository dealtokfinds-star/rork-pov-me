-- 013_categories.sql
-- POV lifestyle categories (seeded in seed.sql).

create table if not exists public.categories (
  id text primary key,
  label text not null,
  tagline text not null,
  emoji text not null,
  accent text not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
