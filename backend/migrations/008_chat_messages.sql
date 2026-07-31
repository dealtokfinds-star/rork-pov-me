-- 008_chat_messages.sql
-- Live stream chat messages. Inserts go through the chat-send edge function.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.live_streams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  text text,
  kind text not null default 'chat', -- chat | tip | gift | join | system
  badge text, -- sub | top | mod
  color text,
  amount numeric,
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_stream on public.chat_messages(stream_id, created_at);
create index if not exists idx_chat_messages_user on public.chat_messages(user_id);
