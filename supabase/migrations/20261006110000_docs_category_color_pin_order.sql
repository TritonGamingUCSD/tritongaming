-- Doc categories get a colour (shown as a dot and a stripe in the docs list), and pinned docs get an order that people can set by dragging.
alter table public.doc_categories add column if not exists color text;
alter table public.docs add column if not exists pin_order int;
