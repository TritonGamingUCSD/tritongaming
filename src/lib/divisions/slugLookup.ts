// Is this address a division's? Used by the proxy for tritongaming.org/<division>. The list of addresses is read from the database at most once a minute per server (a division saved a moment ago may take
// up to a minute to answer at its new address), and a failed read falls back to the last list, or to "no", so a database hiccup never breaks the other addresses.
let cache: { slugs: Set<string>; at: number } | null = null;
let inflight: Promise<Set<string>> | null = null;
const TTL_MS = 60_000;

async function load(): Promise<Set<string>> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/divisions?select=slug`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`divisions ${res.status}`);
  return new Set(((await res.json()) as { slug: string }[]).map((d) => d.slug));
}

export async function isDivisionSlug(slug: string): Promise<boolean> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    inflight ??= load().finally(() => {
      inflight = null;
    });
    try {
      cache = { slugs: await inflight, at: Date.now() };
    } catch {
      cache = { slugs: cache?.slugs ?? new Set(), at: Date.now() - TTL_MS + 5_000 }; // try again in 5 s
    }
  }
  return cache.slugs.has(slug);
}
