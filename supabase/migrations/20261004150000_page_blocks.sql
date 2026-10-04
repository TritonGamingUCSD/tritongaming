-- Event and division pages can be built from designed blocks (text, highlights, FAQ, photo gallery). Null/empty = no extra sections.
alter table public.events add column if not exists page_blocks jsonb;
alter table public.divisions add column if not exists page_blocks jsonb;
