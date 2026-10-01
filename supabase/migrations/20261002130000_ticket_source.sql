-- Where a ticket holder came from (first-touch attribution captured in their browser and sent
-- along when they claim the ticket): e.g. 'Instagram', 'Discord', 'Short link: linktree', 'Direct'.
alter table public.tickets add column if not exists source text;
