-- Store the graduation year (class_of) instead of a relative "3rd Year" that goes
-- stale every September. `year` stays as a derived label ("1st Year".."4th Year"
-- or "Alumni") so everything that reads it keeps working; it is recomputed from
-- class_of by a trigger on save and by a daily job, so it rolls forward on its own.
-- Graduate students / people who pick "Alumni" have no class_of and keep a plain
-- year value ('Graduate' / 'Alumni').

alter table public.profiles
  add column if not exists class_of smallint check (class_of between 2000 and 2100);

-- Academic year runs from September: the "end year" of Oct 2026 is 2027.
create or replace function public.academic_year_end(d date default (now() at time zone 'America/Los_Angeles')::date)
returns int language sql stable as $$
  select extract(year from d)::int + case when extract(month from d) >= 9 then 1 else 0 end
$$;

create or replace function public.class_of_to_year(p_class_of int, d date default (now() at time zone 'America/Los_Angeles')::date)
returns text language sql stable as $$
  select case
    when p_class_of is null then null
    when p_class_of < public.academic_year_end(d) then 'Alumni'
    when p_class_of - public.academic_year_end(d) >= 3 then '1st Year'
    when p_class_of - public.academic_year_end(d) = 2 then '2nd Year'
    when p_class_of - public.academic_year_end(d) = 1 then '3rd Year'
    else '4th Year'
  end
$$;

-- Keep `year` in step with class_of whenever either is written.
create or replace function public.profiles_sync_year()
returns trigger language plpgsql as $$
begin
  if new.class_of is not null then
    new.year := public.class_of_to_year(new.class_of);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_year on public.profiles;
create trigger profiles_sync_year
  before insert or update of class_of, year on public.profiles
  for each row execute function public.profiles_sync_year();

-- Roll every derived year forward (run daily; only touches rows that changed).
create or replace function public.refresh_profile_years()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.profiles
     set year = public.class_of_to_year(class_of)
   where class_of is not null
     and year is distinct from public.class_of_to_year(class_of);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.refresh_profile_years() from public, anon, authenticated;

-- One-time conversion of existing "Nth Year" values into a class year, relative
-- to the academic year the profile was last saved in.
update public.profiles p
set class_of = (
  extract(year from (coalesce(updated_at, created_at) at time zone 'America/Los_Angeles'))::int
  + case when extract(month from (coalesce(updated_at, created_at) at time zone 'America/Los_Angeles')) >= 9 then 1 else 0 end
  + (4 - case p.year when '1st Year' then 1 when '2nd Year' then 2 when '3rd Year' then 3 else 4 end)
)
where p.class_of is null and p.year in ('1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year+');
