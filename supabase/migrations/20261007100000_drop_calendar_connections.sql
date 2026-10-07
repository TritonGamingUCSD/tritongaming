-- Linking a member's own Google Calendar to the portal calendar was removed. The table held the linked accounts and their (encrypted)
-- refresh tokens; the one existing link was revoked at Google and deleted first.
drop table if exists public.calendar_connections;
