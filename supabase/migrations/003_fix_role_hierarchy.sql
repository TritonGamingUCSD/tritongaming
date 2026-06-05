-- ============================================================
-- FIX ROLE HIERARCHY
-- division/lead are now ranked BELOW officer so they don't
-- inherit org-staff permissions (check-in, event management).
-- Run after 001 and 002.
-- ============================================================

create or replace function role_rank(r user_role)
returns int as $$
  select case r
    when 'guest'    then 0
    when 'member'   then 1
    when 'division' then 2  -- game division member (no org-staff perms)
    when 'lead'     then 3  -- game division lead (can edit division page + check-in)
    when 'officer'  then 4  -- org officer (events, check-in, content editing)
    when 'exec'     then 5
    when 'admin'    then 6
    else 0
  end
$$ language sql immutable;
