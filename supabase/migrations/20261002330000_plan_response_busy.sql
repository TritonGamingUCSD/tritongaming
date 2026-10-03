-- What was already on each person's Triton Gaming calendar when they last saved their answers (shown to the host only, to rank times).
alter table public.meeting_plan_responses add column if not exists busy jsonb not null default '[]'::jsonb;
