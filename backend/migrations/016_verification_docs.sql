-- 016_verification_docs.sql
-- Uploaded KYC documents (ID photos, selfie, etc).

create table if not exists public.verification_docs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  doc_type text not null default 'id_front', -- id_front | id_back | selfie
  storage_path text not null,
  status text default 'pending', -- pending | approved | rejected
  review_note text,
  reviewed_at timestamptz,
  reviewer_id text references public.profiles(id),
  uploaded_at timestamptz default now()
);

create index if not exists idx_verification_docs_user on public.verification_docs(user_id);
create index if not exists idx_verification_docs_status on public.verification_docs(status);
