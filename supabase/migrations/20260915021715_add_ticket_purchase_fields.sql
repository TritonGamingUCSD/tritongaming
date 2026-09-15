-- Adds the two columns the ticket-purchase redesign needs.
--
-- events.audience: gates whether non-UCSD-affiliated people can register at
-- all. 'public' (default) = open to everyone (UCSD always free, non-UCSD
-- pays events.ticket_price, which may be 0). 'ucsd_only' = registration
-- rejected server-side for anyone without a @ucsd.edu email.
--
-- tickets.stripe_session_id: set only for paid (non-UCSD) tickets, by the
-- Stripe webhook handler after checkout.session.completed. Used for webhook
-- idempotency (Stripe redelivers events) — UNIQUE prevents a double-insert
-- if the same session fires twice. Null for free tickets.

begin;

alter table public.events
  add column if not exists audience text not null default 'public'
    check (audience in ('public', 'ucsd_only'));

alter table public.tickets
  add column if not exists stripe_session_id text unique;

commit;
