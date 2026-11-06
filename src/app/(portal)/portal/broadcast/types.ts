export type Broadcast = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  platform: 'twitch' | 'youtube' | 'both';
  tournament_id: string | null;
  status: 'scheduled' | 'live' | 'done' | 'cancelled';
  notes: string;
  checklist: Record<string, boolean>;
  vod_url: string | null;
  roles: { id: string; role: string; user_id: string | null; name: string }[];
};
export type TournamentLite = { id: string; name: string; slug: string };

export async function call<T = Record<string, unknown>>(method: string, path: string, body?: object): Promise<{ ok: boolean; j: T & { error?: string } }> {
  try {
    const r = await fetch(path, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, j: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch {
    return { ok: false, j: { error: 'Network error.' } as T & { error?: string } };
  }
}
