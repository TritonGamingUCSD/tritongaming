import { hasCapability, type RoleGrant } from '@/lib/portal/capabilities';

// Who may run which Live Tools item (a Trivia quiz, a poll, a Q&A session, a photo booth). Each belongs to Triton Gaming (`division_id` empty, all of them so far) or to a division.
//   Triton Gaming's: whoever has the club's Live Tools permission (officers and above, `host_trivia`; photo booths `run_photobooth`)
//   a division's:    that division's Members and Heads
//   exec and admin:  everything
export interface LiveScope {
  staff: boolean;
  tg: boolean;
  divisions: string[];
}

export function liveScope(roles: RoleGrant[], capability: 'host_trivia' | 'run_photobooth' = 'host_trivia'): LiveScope {
  const staff = roles.some((r) => r.role === 'exec' || r.role === 'admin');
  const divisions = [...new Set(roles.filter((r) => (r.role === 'division' || r.role === 'division_member') && r.division_id).map((r) => r.division_id as string))];
  return { staff, tg: staff || hasCapability(roles, capability), divisions };
}

export const hasLiveAccess = (s: LiveScope) => s.staff || s.tg || s.divisions.length > 0;

/** May this person run an item with this owner? */
export const canUseLive = (s: LiveScope, divisionId: string | null | undefined) => s.staff || (divisionId ? s.divisions.includes(divisionId) : s.tg);

/** The owner for a new item: the requested one if they may act for it, else (nothing requested) the club's if they may, else their only division. */
export function newItemOwner(s: LiveScope, requested: unknown): { ok: true; division_id: string | null } | { ok: false; error: string } {
  const want = typeof requested === 'string' && requested ? requested : null;
  if (want) return s.staff || s.divisions.includes(want) ? { ok: true, division_id: want } : { ok: false, error: 'You can’t make this for that division.' };
  if (s.tg) return { ok: true, division_id: null };
  if (s.divisions.length === 1) return { ok: true, division_id: s.divisions[0] };
  return { ok: false, error: 'Say which division this is for.' };
}

/** PostgREST filter for lists: only what this person may see. null means everything. */
export function liveListFilter(s: LiveScope): string | null {
  if (s.staff) return null;
  const parts = [...(s.tg ? ['division_id.is.null'] : []), ...(s.divisions.length ? [`division_id.in.(${s.divisions.join(',')})`] : [])];
  return parts.join(',') || 'division_id.eq.00000000-0000-0000-0000-000000000000';
}
