// The word filter's matching, as a pure function of the lists. It mirrors the database function public.wf_blocked (migration 20261106130000), which guards pages that save straight to the database; the server routes use this one.
// Whole words only, so a harmless word that contains a short one is never caught. Digits and @ $ inside a word read as letters (sh1t), repeated letters collapse (fuuuck). Words that are never innocent can also be caught inside longer text.
export interface Term {
  term: string;
  kind: 'block' | 'warn' | 'allow';
  partial?: boolean;
  builtin?: boolean;
}

/** Where a refusal can happen. Each area can be on, log only (let it through but record it) or off. */
export const AREAS = ['profiles', 'content', 'messages'] as const;
export type Area = (typeof AREAS)[number];
export type Mode = 'on' | 'log' | 'off';
/** What a log row records: refused, let through because the area is log only, or let through because the word is only on the warning list. */
export type LogMode = 'on' | 'log' | 'warn';
export const AREA_INFO: Record<Area, { label: string; about: string }> = {
  profiles: { label: 'Profiles', about: 'Names, gamer tags, titles and bios.' },
  content: { label: 'Events, Divisions & Tournaments', about: 'Titles, names, descriptions, locations and stages.' },
  messages: { label: 'Documents & Messages', about: 'Docs, announcements, notes, questions, requests, help and trivia nicknames.' },
};
const MESSAGE_FIELDS = new Set(['document', 'message', 'question', 'notes', 'subject', 'nickname', 'comment']);
/** The area a field belongs to, from the label the route gives it. */
export const areaOf = (label: string): Area => (MESSAGE_FIELDS.has(label.toLowerCase()) ? 'messages' : 'content');

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '+': 't' };
const collapse = (w: string) => w.replace(/(.)\1+/g, '$1');
// Letters from other alphabets that look like Latin ones (Cyrillic and Greek), so "fuсk" with a Cyrillic с is read as fuck.
const LOOKALIKE: Record<string, string> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  х: 'x',
  у: 'y',
  і: 'i',
  ѕ: 's',
  ј: 'j',
  ԁ: 'd',
  ɡ: 'g',
  α: 'a',
  ο: 'o',
  ν: 'v',
  ρ: 'p',
  ι: 'i',
  κ: 'k',
};

/** The text as plain lower-case Latin letters, digits and a few symbols: accents, invisible characters and look-alike letters are removed or mapped. */
export function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ​-‏⁠﻿­]/g, '')
    .replace(/[Ͱ-ϿЀ-ӿɐ-ʯ]/g, (c) => LOOKALIKE[c] ?? c);
}

/**
 * The terms of one list (block by default, or warn) the text hits (empty when it is fine). Allowed words are skipped.
 * Evasions are read through: digits and symbols for letters (b00b, sh1t, a$$), repeated letters (fuuuck), and letters split up by spaces or marks (b o o b, b/oob, bo ob, f-u-c-k, sh!t).
 * Pieces are only joined when each is short, and never across an apostrophe, so "he'll" is not "hell".
 */
export function blockedTerms(text: string | null | undefined, terms: Term[], kind: 'block' | 'warn' = 'block'): string[] {
  if (!text || !text.trim()) return [];
  const block = terms.filter((t) => t.kind === kind);
  const allowTerms = terms.filter((t) => t.kind === 'allow').map((t) => t.term.toLowerCase());
  const allow = new Set(allowTerms);
  const hits = new Set<string>();
  // allowed phrases (a name with spaces) are cut out whole first
  // a ! between letters stands for an i (sh!t)
  let src =
    ' ' +
    plain(text.slice(0, 20000))
      .replace(/([a-z0-9])!(?=[a-z0-9])/g, '$1i')
      .replace(/['’`]/g, ' ~ ')
      .replace(/[^a-z0-9@$+~]+/g, ' ')
      .trim() +
    ' ';
  for (const ph of allowTerms) if (ph.includes(' ')) src = src.split(' ' + ph + ' ').join(' ');
  // every piece as letters (digits and symbols read as letters); '~' marks an apostrophe
  const pieces = src
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((raw) => ({
      raw,
      mapped:
        raw === '~'
          ? '~'
          : [...raw]
              .map((c) => LEET[c] ?? c)
              .join('')
              .replace(/[^a-z]/g, ''),
    }));
  const matches = (mapped: string) => {
    const c = collapse(mapped);
    if (allow.has(mapped) || allow.has(c)) return null;
    for (const b of block) {
      const t = b.term.toLowerCase();
      // a spelling with stretched letters (fuuuck) matches the word squashed too; a plain short word never matches a longer one that squashes to it (as / ass)
      if (t === mapped || t === c || (c !== mapped && collapse(t) === c)) return b.term;
    }
    return null;
  };
  let flat = '';
  for (const p of pieces) {
    if (p.mapped === '~' || !p.mapped || !/[a-z]/.test(p.raw)) continue;
    flat += p.mapped;
    const hit = matches(p.mapped);
    if (hit) hits.add(hit);
  }
  // pieces that are short are also tried joined together
  for (let i = 0; i < pieces.length; i++) {
    let acc = '';
    let n = 0;
    for (let j = i; j < pieces.length && n < 8; j++) {
      const m = pieces[j].mapped;
      if (m === '~') break;
      if (!m) continue;
      if (m.length > 4) break;
      acc += m;
      n++;
      if (acc.length > 24) break;
      if (n >= 2) {
        const hit = matches(acc);
        if (hit) hits.add(hit);
      }
    }
  }
  for (const b of block) if (b.partial && flat.includes(b.term.toLowerCase())) hits.add(b.term);
  return [...hits];
}

export const isBlocked = (text: string | null | undefined, terms: Term[]) => blockedTerms(text, terms).length > 0;

/** The plain message people see. It never repeats the word. */
export const blockedMessage = (label?: string, extra?: string) =>
  (label ? `“${label}” has language that is not allowed here. Please reword it.` : 'That has language that is not allowed here. Please reword it.') +
  (extra?.trim() ? ` ${extra.trim()}` : '');

/** A word an admin types: letters only, lower case, 2 to 40 characters. */
export function cleanTerm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 40);
}

/** A word or phrase to allow: letters and single spaces, lower case, up to 60 characters. */
export function cleanAllow(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Pull words out of pasted text (commas, new lines or semicolons), cleaned and without repeats. */
export function splitWords(raw: string, clean: (s: string) => string = cleanTerm): { words: string[]; invalid: string[] } {
  const words: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[,\n;]+/)) {
    if (!part.trim()) continue;
    const w = clean(part);
    if (w.length < 2) invalid.push(part.trim().slice(0, 40));
    else if (!words.includes(w)) words.push(w);
  }
  return { words, invalid };
}
