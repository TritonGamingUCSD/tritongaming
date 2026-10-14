-- Recruits can scan a member's reward QR and hand a reward over, the same as officers (they already staff check-in).
insert into public.role_capabilities (role, capability) values ('recruit', 'scan_redemptions') on conflict do nothing;
