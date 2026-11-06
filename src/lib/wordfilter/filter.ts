// The word filter's matching, as a pure function of the lists. It mirrors the database function public.wf_blocked (migration 20261106130000), which guards pages that save straight to the database; the server routes use this one.
// Whole words only, so a harmless word that contains a short one is never caught. Digits and @ $ inside a word read as letters (sh1t), repeated letters collapse (fuuuck). Words that are never innocent can also be caught inside longer text.
export interface Term {
  term: string;
  kind: 'block' | 'allow';
  partial?: boolean;
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };
const collapse = (w: string) => w.replace(/(.)\1+/g, '$1');

/** The block terms the text hits (empty when it is fine). Allowed words are skipped. */
export function blockedTerms(text: string | null | undefined, terms: Term[]): string[] {
  if (!text || !text.trim()) return [];
  const block = terms.filter((t) => t.kind === 'block');
  const allow = new Set(terms.filter((t) => t.kind === 'allow').map((t) => t.term.toLowerCase()));
  const hits = new Set<string>();
  let flat = '';
  for (const raw of text.toLowerCase().split(/[^a-z0-9@$]+/)) {
    if (!raw || !/[a-z]/.test(raw)) continue;
    const mapped = [...raw]
      .map((c) => LEET[c] ?? c)
      .join('')
      .replace(/[^a-z]/g, '');
    if (!mapped) continue;
    flat += mapped;
    const c = collapse(mapped);
    if (allow.has(mapped) || allow.has(c)) continue;
    for (const b of block) {
      const t = b.term.toLowerCase();
      if (t === mapped || t === c || collapse(t) === c) hits.add(b.term);
    }
  }
  for (const b of block) if (b.partial && flat.includes(b.term.toLowerCase())) hits.add(b.term);
  return [...hits];
}

export const isBlocked = (text: string | null | undefined, terms: Term[]) => blockedTerms(text, terms).length > 0;

/** The plain message people see. It never repeats the word. */
export const blockedMessage = (label?: string) =>
  label ? `“${label}” has language that is not allowed here. Please reword it.` : 'That has language that is not allowed here. Please reword it.';

/** A word an admin types: letters only, lower case, 2 to 40 characters. */
export function cleanTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 40);
}
