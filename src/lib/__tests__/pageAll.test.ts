import { describe, expect, it } from 'vitest';
import { fetchAll } from '@/lib/trivia/pageAll';

// A stand-in for the database: it never sends more than 1,000 rows for one request, however many are asked for.
const table = (n: number) => {
  const rows = Array.from({ length: n }, (_, i) => ({ i }));
  let calls = 0;
  return { make: (a: number, b: number) => (calls++, Promise.resolve({ data: rows.slice(a, Math.min(b, a + 999) + 1) })), calls: () => calls, rows };
};

describe('reading every row, a page at a time', () => {
  it('gets all 2,500 rows, not the first 1,000', async () => {
    const t = table(2500);
    const got = await fetchAll(t.make);
    expect(got).toHaveLength(2500);
    expect(got[2499]).toEqual({ i: 2499 });
  });
  it('with the count known, asks for the pages together and gets every row once', async () => {
    const t = table(3200);
    const got = await fetchAll(t.make, 3200);
    expect(got).toHaveLength(3200);
    expect(new Set(got.map((r) => r.i)).size).toBe(3200);
    expect(t.calls()).toBe(4);
  });
  it('an empty table and a table of exactly one page both work', async () => {
    expect(await fetchAll(table(0).make)).toHaveLength(0);
    expect(await fetchAll(table(1000).make)).toHaveLength(1000);
    expect(await fetchAll(table(0).make, 0)).toHaveLength(0);
  });
});
