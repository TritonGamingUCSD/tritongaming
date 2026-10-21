-- Logistics tells people what they get in person (Discord), so a request carries no written answer.
alter table public.logistics_requests drop column if exists response;
