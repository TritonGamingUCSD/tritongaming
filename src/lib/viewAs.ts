// "View as": lets an admin preview the portal as another role. It only changes what the pages SHOW
// (getUserRoles() returns the previewed role while the cookie is set); API routes still check the
// admin's real roles, so nothing the preview hides or shows changes what the admin can actually do.
export const VIEW_AS_COOKIE = 'tg_view_as';

export const VIEW_AS_OPTIONS = [
  { id: 'exec', label: 'Exec' },
  { id: 'lead', label: 'Lead' },
  { id: 'officer', label: 'Officer' },
  { id: 'recruit', label: 'Recruit' },
  { id: 'division', label: 'Division lead' },
  { id: 'alumni', label: 'Alumni' },
  { id: 'ucsd', label: 'UCSD member' },
  { id: 'guest', label: 'Guest (no roles)' },
] as const;

export type ViewAsRole = (typeof VIEW_AS_OPTIONS)[number]['id'];
export const isViewAsRole = (v: unknown): v is ViewAsRole => VIEW_AS_OPTIONS.some((o) => o.id === v);
export const viewAsLabel = (id: string) => VIEW_AS_OPTIONS.find((o) => o.id === id)?.label ?? id;

// "View as a specific person": an admin sees the portal exactly as that person does (their roles and their own data) with every change refused.
export const VIEW_USER_COOKIE = 'tg_view_user';
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
