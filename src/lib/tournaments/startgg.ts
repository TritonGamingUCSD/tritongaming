// Reading a start.gg event with their GraphQL API (https://developer.start.gg). It needs a token in STARTGG_API_TOKEN; without one the import says so plainly. Only entrants and seeds are read (public data); nothing is written to start.gg.
export interface StartggEntrant {
  name: string;
  seed: number | null;
}
export interface StartggEvent {
  name: string;
  game: string;
  entrants: StartggEntrant[];
}

const QUERY = `query Entrants($slug: String, $page: Int!) {
  event(slug: $slug) {
    name
    videogame { name }
    entrants(query: { page: $page, perPage: 100 }) {
      pageInfo { totalPages }
      nodes { name seeds { seedNum } }
    }
  }
}`;

export const hasStartggToken = () => !!process.env.STARTGG_API_TOKEN;

export async function fetchStartggEvent(slug: string): Promise<StartggEvent> {
  const token = process.env.STARTGG_API_TOKEN;
  if (!token) throw new Error('start.gg import is not set up yet. An admin needs to add STARTGG_API_TOKEN (a token from start.gg developer settings).');
  const entrants: StartggEntrant[] = [];
  let name = '';
  let game = '';
  for (let page = 1; page <= 10; page++) {
    const res = await fetch('https://api.start.gg/gql/alpha', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: QUERY, variables: { slug, page } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 || res.status === 403) throw new Error('start.gg did not accept the token. An admin needs to check STARTGG_API_TOKEN.');
    if (!res.ok) throw new Error('start.gg is not answering right now. Try again in a minute.');
    const j = (await res.json()) as {
      data?: {
        event?: {
          name?: string;
          videogame?: { name?: string };
          entrants?: { pageInfo?: { totalPages?: number }; nodes?: { name?: string; seeds?: { seedNum?: number }[] }[] };
        } | null;
      };
    };
    const ev = j.data?.event;
    if (!ev) throw new Error('start.gg has no event at that address. Paste the event page link (it has /event/ in it).');
    name = ev.name ?? name;
    game = ev.videogame?.name ?? game;
    for (const n of ev.entrants?.nodes ?? []) if (n.name) entrants.push({ name: n.name.slice(0, 40), seed: n.seeds?.[0]?.seedNum ?? null });
    if (page >= (ev.entrants?.pageInfo?.totalPages ?? 1)) break;
  }
  entrants.sort((a, b) => (a.seed ?? 1e9) - (b.seed ?? 1e9));
  return { name, game, entrants };
}
