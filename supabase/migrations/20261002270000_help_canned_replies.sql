-- Saved replies exec/admin can drop into a help ticket. {name} is replaced with the asker's first name.
create table if not exists public.help_canned_replies (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.help_canned_replies enable row level security;   -- service role only
insert into public.help_canned_replies (title, body)
select * from (values
  ('Looking into it', 'Hi {name}, thanks for letting us know. We''re looking into this and will get back to you here as soon as we have an update.'),
  ('Need more details', 'Hi {name}, could you tell us a bit more? A screenshot, what page you were on, and what you expected to happen would help us track it down.'),
  ('Try refreshing', 'Hi {name}, could you try refreshing the page (or signing out and back in) and let us know if it still happens? If it does, send a screenshot and we''ll dig in.'),
  ('Fixed, please confirm', 'Hi {name}, this should be fixed now. Could you check and let us know if it works for you? We''ll close the ticket once you confirm.')
) as v(title, body)
where not exists (select 1 from public.help_canned_replies);
