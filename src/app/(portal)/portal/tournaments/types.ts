import type { EntrantRow, MatchRow, TournamentRow } from '@/lib/tournaments/store';

// What the organizer screen reads from /api/tournaments/<id> (see that route: the public view leaves out tokens and codes).
export type TEntrant = Pick<EntrantRow, 'id' | 'name' | 'seed' | 'checked_in' | 'dropped' | 'members'> & { user_id?: string | null; claim_code?: string | null; linked?: boolean };
export type TData = {
  tournament: Omit<TournamentRow, 'created_by'>;
  entrants: TEntrant[];
  matches: MatchRow[];
  staff?: string[];
  can: { manage: boolean; run: boolean };
};

export const FORMAT_NAMES: Record<string, string> = { single: 'Single elimination', double: 'Double elimination', roundrobin: 'Round robin', swiss: 'Swiss', points: 'Points' };
export const STATUS_NAMES: Record<string, string> = { draft: 'Draft', registration: 'Sign-ups open', live: 'Live', complete: 'Finished' };

export async function call<T = Record<string, unknown>>(method: string, path: string, body?: object): Promise<{ ok: boolean; j: T & { error?: string } }> {
  try {
    const r = await fetch(path, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, j: (await r.json().catch(() => ({}))) as T & { error?: string } };
  } catch {
    return { ok: false, j: { error: 'Network error.' } as T & { error?: string } };
  }
}

export const roundName = (bracket: string, round: number, maxRound: number): string => {
  if (bracket === 'GF') return round === 1 ? 'Grand final' : 'Bracket reset';
  if (bracket === 'T') return 'Third place';
  if (bracket === 'L') return `Losers round ${round}`;
  if (bracket === 'W') return round === maxRound ? 'Final' : round === maxRound - 1 && maxRound >= 3 ? 'Semifinals' : `Round ${round}`;
  return `Round ${round}`;
};
