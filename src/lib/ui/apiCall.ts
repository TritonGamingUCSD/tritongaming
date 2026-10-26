// The one way the portal's screens talk to its routes with JSON: `ok` with the data, or `error` in words (a 409 "someone just changed this" also carries its `body`, and every failure its `status`, 0 when the server
// could not be reached). Used by Logistics and Staffle.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; body?: { code?: string; current?: number; by?: string } };

export async function call<T>(url: string, method = 'GET', body?: unknown): Promise<ApiResult<T>> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong.', status: r.status, body: j };
    return { ok: true, data: j as T };
  } catch { return { ok: false, error: 'Couldn’t reach the server.', status: 0 }; }
}
