-- Unsaved Site Content edits, so the editor's live preview can render the real public page with them. One row per editor;
-- only ever read/written by the server (service role), and only used to render the preview, never the public site.
create table if not exists public.content_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  drafts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.content_drafts enable row level security;
