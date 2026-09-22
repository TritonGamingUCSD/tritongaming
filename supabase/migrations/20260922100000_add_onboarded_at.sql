-- Tracks whether a member has been through the portal's first-time
-- welcome guide (OnboardingGuide.tsx) — null means "show it next time
-- they land on /portal", set once they dismiss/complete it. A DB column
-- rather than localStorage so it persists across devices/browsers, same
-- reasoning as preferred_email/board_order.

begin;

alter table public.profiles add column if not exists onboarded_at timestamptz;

commit;
