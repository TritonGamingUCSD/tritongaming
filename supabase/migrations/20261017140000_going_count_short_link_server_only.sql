-- The site calls these two from its own server with the service key, so the public REST endpoint no longer needs to expose them.
revoke execute on function public.event_going_count(uuid) from public, anon, authenticated;
revoke execute on function public.resolve_short_link(text) from public, anon, authenticated;
