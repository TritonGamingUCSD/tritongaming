-- The station's short "what they do" note and the guide's instructions were the same thing. Instructions are now the one place; copy any note across (the old column stays, unused).
update public.shift_stations set instructions = description where instructions is null and description is not null;
