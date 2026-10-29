// Turning what an admin pasted into a clean list of addresses. Client-safe (the panel shows the count as they type; the server does the same again before sending).

export const MAX_BLAST = 50; // one test blast never goes to more than this many addresses
const ADDRESS = /^[^\s@<>()[\]\\,;:]+@[^\s@<>()[\]\\,;:]+\.[^\s@<>()[\]\\,;:]{2,}$/;

/** Addresses split out of free text (commas, semicolons, spaces, new lines, "Name <a@b.c>"), lower-cased, without duplicates; `bad` is what was left over and is not an address. */
export function parseRecipients(text: string): { valid: string[]; bad: string[] } {
  const valid: string[] = [],
    bad: string[] = [],
    seen = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const t = raw
      .trim()
      .replace(/^.*<([^>]+)>.*$/, '$1')
      .replace(/^<|>$/g, '');
    if (!t) continue;
    const a = t.toLowerCase();
    if (!ADDRESS.test(a) || a.length > 254) {
      bad.push(raw.trim());
      continue;
    }
    if (!seen.has(a)) {
      seen.add(a);
      valid.push(a);
    }
  }
  return { valid, bad };
}
