// The filters the Audit Log tab and its export share: type, action, a date range and a search of the summary or the person.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAuditFilters<Q extends { eq: (c: string, v: string) => Q; gte: (c: string, v: string) => Q; lt: (c: string, v: string) => Q; or: (f: string) => Q }>(query: Q, params: URLSearchParams): Q {
  const type = params.get('type'), action = params.get('action'), from = params.get('from'), to = params.get('to');
  const q = (params.get('q') ?? '').trim().replace(/[%,()]/g, ' ');
  const valid = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  if (type) query = query.eq('entity_type', type);
  if (action) query = query.eq('action', action);
  const f = valid(from), t = valid(to);
  if (f) query = query.gte('created_at', f);
  if (t) query = query.lt('created_at', t);
  if (q) query = query.or(`summary.ilike.%${q}%,actor_name.ilike.%${q}%`);
  return query;
}

// What can be filtered on, taken from the log itself (the newest rows), so new kinds of entries show up without editing a list.
export function auditFacets(rows: { entity_type: string; action: string }[]) {
  const count = (key: 'entity_type' | 'action') => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
  };
  return { types: count('entity_type'), actions: count('action') };
}
