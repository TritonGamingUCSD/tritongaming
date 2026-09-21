-- The online self-check-in code (see EVENT_CODE_ROTATION_SECONDS in
-- rotatingCode.ts) needs an HMAC key that's actually secret — events.id is
-- already visible to any authenticated user in the events list, so keying
-- the rotating code off it directly would let anyone compute a valid code
-- themselves for any event/time window without ever seeing the officer's
-- "reveal code" screen, defeating the whole mechanism. Mirrors exactly how
-- tickets.ticket_code already does this (a random secret that never
-- leaves the server) — same pattern, applied to events instead of tickets.

begin;

alter table public.events add column checkin_secret text;

update public.events set checkin_secret = encode(gen_random_bytes(16), 'hex') where checkin_secret is null;

alter table public.events
  alter column checkin_secret set not null,
  alter column checkin_secret set default encode(gen_random_bytes(16), 'hex');

commit;
