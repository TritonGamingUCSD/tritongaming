-- "inactive": a marker role that sits next to someone's real roles (officer, lead) while they are inactive for the quarter. It grants nothing; it makes
-- permission checks (has_capability here, hasCapability in the app) drop their editing and acting powers. The roles themselves are untouched.
alter type public.app_role add value if not exists 'inactive';
