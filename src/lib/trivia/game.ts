// The rules of a Trivia game, with no database in them so they can be tested on their own.

export const CHOICES = 4;
export const DEFAULT_SECS = 40;
export const MIN_SECS = 5;
export const MAX_SECS = 120;
export const MAX_POINTS = 1000;
/** A question with a category opens on a category card this long (the question and its clock start after it). */
export const CARD_MS = 3000;
// A tap that reaches the server this long after the clock ran out still counts (phones and networks lag a little).
export const GRACE_MS = 1500;

export type Rng = () => number;

/** The short join code: 6 digits, so it can be typed on a number pad (the Scan button's code box takes it too). */
export function makeCode(rng: Rng = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += Math.floor(rng() * 10);
  return s;
}
/** What a person typed (spaces, a dash, a pasted link) as a join code, or null when it can't be one. Codes of games made before the codes were digits only (they had letters) still read. */
export function cleanCode(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = t.length > 6 ? t.slice(-6) : t;
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

/** Right answers earn up to 1000 points: all of it for an instant answer, half of it for one at the last second. Wrong or late answers earn nothing. */
export function pointsFor(ok: boolean, ms: number, secs: number): number {
  if (!ok) return 0;
  const total = secs * 1000;
  const t = Math.min(Math.max(ms, 0), total);
  return Math.round(MAX_POINTS * (1 - t / total / 2));
}

export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export interface PoolQuestion { id: string; text: string; choices: string[]; correct: number; category?: string }
export interface PlannedQuestion { id: string; text: string; choices: string[]; correct: number; secs: number; category?: string }   // choices as shown (shuffled); correct is a position in them

/** A question can be asked once it has a category, text, four answers, and a right one that is filled in. */
export function isAskable(q: { text: string; choices: string[]; correct: number; category?: string }): boolean {
  return (q.category ?? '').trim() !== '' && q.text.trim() !== '' && q.choices.length === CHOICES && q.choices.every((c) => c.trim() !== '') && q.correct >= 0 && q.correct < CHOICES;
}

/**
 * The questions of one game: `count` drawn at random from the pool, questions no earlier game of the quiz used first (then repeats if the pool runs out), with the answers of each shuffled.
 * `used` is every question id earlier games of this quiz asked.
 */
export function drawGame(pool: PoolQuestion[], used: ReadonlySet<string>, count: number, rng: Rng = Math.random): PlannedQuestion[] {
  const ready = pool.filter(isAskable);
  const fresh = shuffle(ready.filter((q) => !used.has(q.id)), rng);
  const repeats = shuffle(ready.filter((q) => used.has(q.id)), rng);
  return [...fresh, ...repeats].slice(0, Math.max(0, count)).map((q) => {
    const order = shuffle(q.choices.map((_, i) => i), rng);
    return { id: q.id, text: q.text.trim(), choices: order.map((i) => q.choices[i].trim()), correct: order.indexOf(q.correct), secs: suggestSecs(q), category: (q.category ?? '').trim() };
  });
}

export interface Standing { user_id: string; name: string; score: number; time_ms: number; rank: number }
/** Highest score first; equal scores are split by the shorter total time on right answers. Players still tied share a rank. */
export function standings(players: { user_id: string; name: string; score: number; time_ms: number }[]): Standing[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.time_ms - b.time_ms || a.name.localeCompare(b.name) || a.user_id.localeCompare(b.user_id));
  return sorted.map((p, i) => {
    const prev = sorted[i - 1];
    const tied = prev && prev.score === p.score && prev.time_ms === p.time_ms;
    return { ...p, rank: tied ? 0 : i + 1 };
  }).reduce<Standing[]>((out, p) => { out.push({ ...p, rank: p.rank || out[out.length - 1].rank }); return out; }, []);
}

/** Totals from the answers given so far, for the players still in the game. */
export function totals(players: { user_id: string; name: string }[], answers: { user_id: string; points: number; ms: number; ok: boolean }[]): { user_id: string; name: string; score: number; time_ms: number }[] {
  const by = new Map(players.map((p) => [p.user_id, { ...p, score: 0, time_ms: 0 }]));
  for (const a of answers) { const t = by.get(a.user_id); if (t) { t.score += a.points; if (a.ok) t.time_ms += a.ms; } }
  return [...by.values()];
}

/** The three who can't return to this quiz: first, second and third place. Ties for third are broken by the standings' own order (shorter total time), so it is always exactly three people (fewer if fewer played). */
export function topThree(list: Standing[]): Standing[] {
  return list.filter((p) => p.score > 0).slice(0, 3);
}

/**
 * How long a question runs. It is always automatic (nobody sets it) and roomy, since people have to look up, find the phone, read, think and tap: 30 seconds for all that plus a second a word over the question and
 * all four answers, up to the next 5 seconds, between 40 and 120. (A question with no text yet gets the default.)
 */
export function suggestSecs(q: { text: string; choices: string[] }): number {
  if (!q.text.trim()) return DEFAULT_SECS;
  const words = [q.text, ...q.choices].join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(40, Math.min(120, Math.ceil((30 + words) / 5) * 5));
}

export interface BulkQuestion { text: string; choices: string[]; correct: number; category: string }

/**
 * Questions pasted as text: the question, then its answers on lines starting with A. B. C. D. (A) or A: , the right one marked with a * in front or behind it (or "(correct)" after it), or an "Answer: B" line after them.
 * A "Category: Gaming" line before a question gives its category to that question and to every one after it until the next Category line (every question needs one). Questions may be separated by blank lines or just follow each other; a leading "1." or "Q1:" on the question is dropped. Anything that can't be read is listed in `problems` and left out.
 */
export function parseBulk(input: string): { questions: BulkQuestion[]; problems: string[] } {
  const questions: BulkQuestion[] = [];
  const problems: string[] = [];
  type Draft = { text: string[]; choices: string[]; correct: number; answer: number; category: string };
  let cur: Draft | null = null;
  let n = 0;
  let sticky = '';
  const finish = () => {
    if (!cur) return;
    n++;
    const text = cur.text.join(' ').replace(/^\s*(?:q(?:uestion)?\s*)?\d+\s*[.):]\s*/i, '').replace(/^\s*q\s*[.):]\s*/i, '').trim();
    const label = `Question ${n}${text ? ` (“${text.slice(0, 40)}${text.length > 40 ? '…' : ''}”)` : ''}`;
    const right = cur.correct >= 0 ? cur.correct : cur.answer;
    if (!text) problems.push(`${label}: no question text.`);
    else if (!cur.category.trim()) problems.push(`${label}: no category. Put a “Category: Gaming” line before the question (or fill the category column).`);
    else if (cur.choices.length !== CHOICES) problems.push(`${label}: needs four answers (A to D), found ${cur.choices.length}.`);
    else if (right < 0) problems.push(`${label}: no right answer marked. Put a * by it or add an "Answer: B" line.`);
    else questions.push({ text: text.slice(0, 300), choices: cur.choices.map((c) => c.slice(0, 120)), correct: right, category: cur.category.slice(0, 40) });
    cur = null;
  };
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cat = /^category\s*[:=-]\s*(.*)$/i.exec(line);
    if (cat) {
      if (cur && cur.choices.length) finish();   // a category line after the answers belongs to the next question
      sticky = cat[1].trim();   // it holds for every question after it, until the next Category line
      if (!cur) cur = { text: [], choices: [], correct: -1, answer: -1, category: sticky };
      cur.category = sticky;
      continue;
    }
    const ans = /^(?:answer|ans|correct|right)\s*[:=-]\s*\(?([A-Da-d])\)?\b/i.exec(line);
    if (ans && cur && cur.choices.length) { cur.answer = 'ABCD'.indexOf(ans[1].toUpperCase()); continue; }
    const opt = /^(\*?)\s*\(?([A-Da-d])\s*(?:[.):]|\])\s*(.*)$/.exec(line);
    if (opt && cur && cur.choices.length < CHOICES && 'ABCD'.indexOf(opt[2].toUpperCase()) === cur.choices.length) {
      let body = opt[3].trim();
      let mark = opt[1] === '*';
      if (/\s*\*$/.test(body)) { mark = true; body = body.replace(/\s*\*+$/, ''); }
      if (/\s*[(\[]\s*(?:correct|right|answer)\s*[)\]]$/i.test(body)) { mark = true; body = body.replace(/\s*[(\[]\s*(?:correct|right|answer)\s*[)\]]$/i, ''); }
      if (/\s*✓$/.test(body)) { mark = true; body = body.replace(/\s*✓$/, ''); }
      if (mark && cur.correct < 0) cur.correct = cur.choices.length;
      cur.choices.push(body.trim());
      continue;
    }
    if (cur && cur.choices.length) finish();   // a line of text after the answers starts the next question
    if (!cur) cur = { text: [], choices: [], correct: -1, answer: -1, category: sticky };
    cur.text.push(line);
  }
  finish();
  return { questions, problems };
}

/** Rows of a CSV file (quoted fields, doubled quotes and line breaks inside quotes understood). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/** A CSV with the columns category, question, A, B, C, D, answer (a letter, or the text of the right answer), as the text `parseBulk` reads. A header row is skipped. */
export function csvToBulk(input: string): string {
  return parseCsv(input)
    .filter((r, i) => !(i === 0 && /^(category|q(uestion)?)$/i.test(r[0].trim())))   // a header row is skipped
    .map((r) => {
      const [category = '', text = '', ...rest] = r.map((c) => c.trim());
      const choices = rest.slice(0, CHOICES);
      const ans = (rest[CHOICES] ?? '').trim();
      const letter = /^[A-Da-d]$/.test(ans) ? ans.toUpperCase() : 'ABCD'[choices.findIndex((c) => c.toLowerCase() === ans.toLowerCase() && ans !== '')] ?? '';
      return [`Category: ${category}`, text, ...choices.map((c, i) => `${'ABCD'[i]}. ${c}`), letter ? `Answer: ${letter}` : ''].filter(Boolean).join('\n');
    })
    .join('\n\n');
}
