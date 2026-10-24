-- Guests who play Trivia without an account sign in anonymously (Supabase "anonymous sign-ins"). Such a session uses the `authenticated` database role, so every policy written for signed-in people would also apply
-- to a guest. This blocks guests everywhere they have no business: a RESTRICTIVE policy (it is ANDed with the existing ones) on every public table and on file storage that lets only non-anonymous sessions through.
-- Guests only ever reach Trivia, and Trivia goes through the site's own routes (service role), which are not affected. People with an account and visitors who are not signed in are not affected either.
-- A NEW table (or storage bucket policy) added later needs the same line: copy the one inside the loop below.
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_tables where (schemaname = 'public' and rowsecurity) or (schemaname = 'storage' and tablename = 'objects') loop
    execute format('drop policy if exists "no anonymous sessions" on %I.%I', t.schemaname, t.tablename);
    execute format($p$create policy "no anonymous sessions" on %I.%I as restrictive for all to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false) with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)$p$, t.schemaname, t.tablename);
  end loop;
end $$;

-- A guest has no profile: no row in the members' list, in the public profile list, or in anyone's counts.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $function$
declare
  _full_name text;
begin
  if new.is_anonymous then return new; end if;
  _full_name := trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));

  insert into public.profiles (id, display_name, avatar_url, google_first_name, google_last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    nullif(split_part(_full_name, ' ', 1), ''),
    nullif(trim(substring(_full_name from length(split_part(_full_name, ' ', 1)) + 1)), '')
  )
  on conflict (id) do nothing;

  if new.email ilike '%@ucsd.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'ucsd') on conflict do nothing;
  end if;

  return new;
end;
$function$;
