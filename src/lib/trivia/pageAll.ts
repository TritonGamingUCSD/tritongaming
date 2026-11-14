// The database sends at most 1,000 rows for one request, however high a `.limit()` is: a game with 300 players and 8 questions has 2,400 answers, and reading "all" of them with one request quietly gave a third of them, so scores came out wrong.
// This reads every row, a page at a time. Pass what a page is: `make(from, to)` returns the query for rows `from` to `to` (inclusive, with a stable `.order(...)` so pages do not overlap). With `count`, the pages are asked for at once.

const PAGE = 1000;
type Page<T> = PromiseLike<{ data: T[] | null; error?: unknown }>;

export async function fetchAll<T>(make: (from: number, to: number) => Page<T>, count?: number): Promise<T[]> {
  if (typeof count === 'number') {
    const pages = Math.ceil(count / PAGE);
    const parts = await Promise.all(Array.from({ length: pages }, (_, i) => make(i * PAGE, i * PAGE + PAGE - 1)));
    return parts.flatMap((p) => p.data ?? []);
  }
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data } = await make(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
