-- Locations are written per event now (Setup > Guides); the old station-wide ones could no longer be edited, so clear them.
-- (On-Stage: "Stage of East/West Ballroom", Tech Lead On-Call: "Tech Booth". Division Showcase already has its own location for both.)
update public.shift_stations set location = null where location is not null;
