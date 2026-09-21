-- Distinguishes an online-only event from an in-person one, so the portal
-- can show the right check-in UI per event instead of always offering
-- both a QR scan (which needs someone physically present with a camera)
-- and the online code-entry flow (which only makes sense when there's no
-- in-person line to scan at all).
alter table public.events add column if not exists is_online boolean not null default false;
