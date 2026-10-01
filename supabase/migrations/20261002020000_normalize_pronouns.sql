-- Pronouns became a dropdown (He/Him, She/Her, They/Them, He/They, She/They,
-- Any pronouns, Prefer not to say, or a custom "Other" text). Fit every
-- existing free-text value to the closest option; anything that doesn't
-- match a known pattern is left exactly as typed (it shows up under "Other").
update public.profiles p
set pronouns = m.mapped
from (
  select id,
    case
      when k in ('he/him','he','him','he/him/any','he/any') then 'He/Him'
      when k in ('she/her','she','her','she/any') then 'She/Her'
      when k in ('they/them','they','them') then 'They/Them'
      when k = 'he/they' then 'He/They'
      when k = 'she/they' then 'She/They'
      when k in ('any/all','any','all','she/her/he/him') then 'Any pronouns'
    end as mapped
  from (
    select id, regexp_replace(lower(btrim(pronouns)), '\s+', '/', 'g') as k
    from public.profiles
    where pronouns is not null and btrim(pronouns) <> ''
  ) s
) m
where p.id = m.id and m.mapped is not null and p.pronouns is distinct from m.mapped;
