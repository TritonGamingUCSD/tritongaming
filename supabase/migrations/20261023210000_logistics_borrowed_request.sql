-- Sponsor loaners and officer loaners can fill a request's rows too, so they remember which request (and which line of it) they were given to.
alter table public.logistics_plan_borrowed add column if not exists request_id uuid;
alter table public.logistics_plan_borrowed add column if not exists request_item text;
