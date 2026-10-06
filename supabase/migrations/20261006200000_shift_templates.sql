-- Saved write-ups for "what to do" (Emcee, Check-in...). Picking one on a station copies its text into the station's instructions; exec can then edit it.
create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  body text not null check (char_length(body) between 1 and 4000),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.shift_templates enable row level security;

insert into public.shift_templates (name, body, sort_order) values
  ('Emcee', E'Arrive 15 minutes early. Check the mic and read through the script.\nWelcome everyone and say what is happening next.\nKeep to the schedule and introduce each act or announcement.\nIf something runs long or goes wrong, tell a lead before changing the plan.', 0),
  ('Check-in table', E'Be at the table 15 minutes before doors open.\nScan each ticket or look the person up by name.\nSend anyone with a problem to a lead instead of letting them in by hand.\nKeep the line moving and greet everyone.', 1),
  ('Station watch', E'Stay at your station for the whole shift.\nHelp people get started and keep the area tidy.\nTell a lead right away about any broken equipment or issue.\nHand off to the next person before you leave.', 2);
