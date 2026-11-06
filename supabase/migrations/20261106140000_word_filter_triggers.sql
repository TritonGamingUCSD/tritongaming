-- Word filter on the other pages that save straight to the database from the browser: events and divisions. (Profiles are in the first word filter migration.) A value that did not change is never re-checked.
create or replace function public.events_word_filter() returns trigger
language plpgsql as $$
begin
  if (new.title is distinct from old.title and public.wf_blocked(new.title))
     or (new.name is distinct from old.name and public.wf_blocked(new.name))
     or (new.description is distinct from old.description and public.wf_blocked(new.description))
     or (new.content is distinct from old.content and public.wf_blocked(new.content))
     or (new.location is distinct from old.location and public.wf_blocked(new.location))
     or (new.post_event_info is distinct from old.post_event_info and public.wf_blocked(new.post_event_info))
     or (new.venue_notes is distinct from old.venue_notes and public.wf_blocked(new.venue_notes)) then
    raise exception 'That contains language that is not allowed here. Please reword it.' using errcode = 'P0001', hint = 'word_filter';
  end if;
  return new;
end $$;
drop trigger if exists events_word_filter_trg on public.events;
create trigger events_word_filter_trg before update on public.events for each row execute function public.events_word_filter();

create or replace function public.events_word_filter_insert() returns trigger
language plpgsql as $$
begin
  if public.wf_blocked(new.title) or public.wf_blocked(new.name) or public.wf_blocked(new.description) or public.wf_blocked(new.content) or public.wf_blocked(new.location) then
    raise exception 'That contains language that is not allowed here. Please reword it.' using errcode = 'P0001', hint = 'word_filter';
  end if;
  return new;
end $$;
drop trigger if exists events_word_filter_ins_trg on public.events;
create trigger events_word_filter_ins_trg before insert on public.events for each row execute function public.events_word_filter_insert();

create or replace function public.divisions_word_filter() returns trigger
language plpgsql as $$
begin
  if (new.name is distinct from old.name and public.wf_blocked(new.name))
     or (new.description is distinct from old.description and public.wf_blocked(new.description))
     or (new.tagline is distinct from old.tagline and public.wf_blocked(new.tagline)) then
    raise exception 'That contains language that is not allowed here. Please reword it.' using errcode = 'P0001', hint = 'word_filter';
  end if;
  return new;
end $$;
drop trigger if exists divisions_word_filter_trg on public.divisions;
create trigger divisions_word_filter_trg before update on public.divisions for each row execute function public.divisions_word_filter();
