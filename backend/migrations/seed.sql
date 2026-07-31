-- seed.sql
-- Seed data: POV categories + one admin user placeholder.

-- Categories (matching constants/mock-data.ts CATEGORIES)
insert into public.categories (id, label, tagline, emoji, accent, sort_order, is_active) values
  ('trader',    'Trader',    'Charts, scalps, PnL',     '📈',  '#CCFF00', 1, true),
  ('bettor',    'Bettor',    'Models & live sweats',    '🎲',  '#FFB627', 2, true),
  ('founder',   'Founder',   'Pitch days & builds',     '🚀',  '#35E7FF', 3, true),
  ('luxury',    'Luxury',    'Supercars, yachts',       '🏎️',  '#FFB627', 4, true),
  ('nightlife', 'Nightlife', 'Tables & afterhours',     '🌃',  '#FF2D6F', 5, true),
  ('travel',    'Travel',    'Cities, nomad life',      '🌍',  '#35E7FF', 6, true),
  ('athlete',   'Athlete',   'Training & fight night',  '🥊',  '#FF2D6F', 7, true),
  ('global',    'Global',    'Be someone elsewhere',    '🛰️',  '#CCFF00', 8, true)
on conflict (id) do nothing;

-- NOTE: Admin user is created automatically when a user signs in and is
-- manually promoted via: update profiles set is_admin = true where id = '...';
-- Or uncomment and replace the UUID below to seed a known admin:
-- insert into public.profiles (id, email, name, is_admin, is_creator, onboarded, verified)
-- values ('00000000-0000-0000-0000-000000000000', 'admin@povme.app', 'Admin', true, true, true, true)
-- on conflict (id) do nothing;
