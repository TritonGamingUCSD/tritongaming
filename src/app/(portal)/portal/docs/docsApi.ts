// Small fetch helper for the docs routes. Every route answers { error?, code? }: `code` is what tells a conflict apart from a plain failure.

export interface ApiResult<T = Record<string, unknown>> { ok: boolean; status: number; json: T & { error?: string; code?: string } }

export async function docsPost<T = Record<string, unknown>>(path: string, body: unknown, opts: { keepalive?: boolean } = {}): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: opts.keepalive });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json };
  } catch {
    return { ok: false, status: 0, json: { error: 'Couldn’t reach the server. Check your connection.', code: 'offline' } as ApiResult<T>['json'] };
  }
}

export async function docsGet<T = Record<string, unknown>>(path: string): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, { cache: 'no-store' });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json };
  } catch {
    return { ok: false, status: 0, json: { error: 'Couldn’t reach the server.', code: 'offline' } as ApiResult<T>['json'] };
  }
}

export const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }) : '');
export const dayTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
