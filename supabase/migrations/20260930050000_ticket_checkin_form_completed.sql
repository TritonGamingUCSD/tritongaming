-- Honor-system tracking for the AS Form, not proof of an actual Google
-- Forms submission — the app has no way to detect that (cross-origin
-- iframe, no callback Google Forms provides). This only records that the
-- attendee told us they finished it (an explicit "I've Completed This
-- Form" button, not just closing the modal) — see
-- CheckinFormModal.tsx/api/tickets/[id]/checkin-form-complete. Once set,
-- the "Complete AS Form" button stops re-offering the form for that
-- ticket, which prevents *our own UI* from inviting a second submission —
-- it can't stop someone from revisiting the raw form URL directly, which
-- is why the real, authoritative fix is the form's own "Limit to 1
-- response" setting (tied to their UCSD Google account), controlled by
-- whoever owns that Google Form, not by us.
alter table public.tickets
  add column if not exists checkin_form_completed_at timestamptz;
