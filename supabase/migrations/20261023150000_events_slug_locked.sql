-- An event's slug is set once and never changed: links, QR codes and the Logistics plan all use it. A slug can still be set when there is none yet.
create or replace function public.events_slug_locked() returns trigger language plpgsql as $$
begin
  if old.slug is not null and new.slug is distinct from old.slug then
    raise exception 'An event''s URL slug cannot be changed once it is set.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists events_slug_locked on public.events;
create trigger events_slug_locked before update of slug on public.events for each row execute function public.events_slug_locked();
