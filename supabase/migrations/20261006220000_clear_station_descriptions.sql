-- The station's short note ("Check in attendees"...) is gone from the grid and can no longer be edited, so clear what was left. What each station does is written per event.
update public.shift_stations set description = null, instructions = null where description is not null or instructions is not null;
