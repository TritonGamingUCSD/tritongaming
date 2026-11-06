-- Docs with two lists: who can read, who can edit. Each is a list of entries (everyone, signed in, a role, a team, a person, a division's Heads, Members or Alumni). Division docs start with it; the club's docs follow later.
-- Existing division docs keep exactly who could read them (from `audience`); editing was for the division's Heads and Members before and stays so.
alter table public.division_docs add column if not exists read_access jsonb;
alter table public.division_docs add column if not exists edit_access jsonb;
update public.division_docs set
  read_access = case audience
    when 'public'   then '[{"t":"everyone"}]'::jsonb
    when 'division' then jsonb_build_array(jsonb_build_object('t','division','role','division','division_id',division_id), jsonb_build_object('t','division','role','division_member','division_id',division_id), jsonb_build_object('t','division','role','division_alumni','division_id',division_id))
    when 'members'  then jsonb_build_array(jsonb_build_object('t','division','role','division','division_id',division_id), jsonb_build_object('t','division','role','division_member','division_id',division_id))
    else                 jsonb_build_array(jsonb_build_object('t','division','role','division','division_id',division_id))
  end,
  edit_access = jsonb_build_array(jsonb_build_object('t','division','role','division','division_id',division_id), jsonb_build_object('t','division','role','division_member','division_id',division_id))
where read_access is null;
