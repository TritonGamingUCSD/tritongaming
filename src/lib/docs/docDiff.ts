// What changed between two versions of a doc, in the form the version history shows it: untouched text, whole blocks that were added or removed, and lines that were edited
// (with the words that changed marked). Plain functions with no screen code so they can be tested.

export type DiffPart = { op: 'same' | 'add' | 'del'; text: string };
export type DiffBlock =
  | { kind: 'same'; text: string }
  | { kind: 'add'; text: string }
  | { kind: 'del'; text: string }
  | { kind: 'change'; prefix: string; parts: DiffPart[] };

// Longest common stretch of two lists; returns the list with each item marked kept, added or removed.
function diffSeq<T>(a: T[], b: T[], key: (x: T) => unknown = (x) => x): { op: 'same' | 'add' | 'del'; v: T }[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = key(a[i]) === key(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: 'same' | 'add' | 'del'; v: T }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) { out.push({ op: 'same', v: b[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: 'del', v: a[i++] });
    else out.push({ op: 'add', v: b[j++] });
  }
  while (i < n) out.push({ op: 'del', v: a[i++] });
  while (j < m) out.push({ op: 'add', v: b[j++] });
  return out;
}

const MARK = /^(#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s*)/;
// Markdown marks in the middle of a line are left out of the word comparison so "**bold**" and "bold" read as the same word.
const plainWords = (s: string) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '');

export function wordDiff(before: string, after: string): DiffPart[] {
  const a = plainWords(before).split(/(\s+)/).filter((t) => t !== '');
  const b = plainWords(after).split(/(\s+)/).filter((t) => t !== '');
  const parts: DiffPart[] = [];
  // Words match regardless of capital letters or a full stop after them, so a reworded sentence marks only the words that really changed.
  for (const d of diffSeq(a, b, (w) => w.toLowerCase().replace(/[.,;:!?]+$/, ''))) {
    const last = parts[parts.length - 1];
    if (last && last.op === d.op) last.text += d.v; else parts.push({ op: d.op, text: d.v });
  }
  return parts;
}

// Lines that were rewritten (not just touched) read better as "old block removed, new block added" than as a jumble of marked words.
const similar = (parts: DiffPart[]) => {
  const len = (ops: string[]) => parts.filter((p) => ops.includes(p.op)).reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0);
  const kept = len(['same']);
  const total = len(['same', 'del']) + len(['same', 'add']);
  return total > 0 && (2 * kept) / total >= 0.4;
};

export function diffDocs(before: string, after: string): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  const push = (kind: 'same' | 'add' | 'del', text: string) => {
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind) last.text += `\n${text}`; else blocks.push({ kind, text } as DiffBlock);
  };
  const ops = diffSeq(before.split('\n'), after.split('\n'));
  let i = 0;
  while (i < ops.length) {
    if (ops[i].op === 'same') { push('same', ops[i].v); i++; continue; }
    const dels: string[] = [], adds: string[] = [];
    while (i < ops.length && ops[i].op !== 'same') { (ops[i].op === 'del' ? dels : adds).push(ops[i].v); i++; }
    const d = dels.filter((l) => l.trim()), a = adds.filter((l) => l.trim());
    const pairs = Math.min(d.length, a.length);
    for (let k = 0; k < pairs; k++) {
      const prefix = a[k].match(MARK)?.[0] ?? '';
      const parts = wordDiff(d[k].replace(MARK, ''), a[k].replace(MARK, ''));
      if (similar(parts)) blocks.push({ kind: 'change', prefix, parts });
      else { push('del', d[k]); push('add', a[k]); }
    }
    for (const l of d.slice(pairs)) push('del', l);
    for (const l of a.slice(pairs)) push('add', l);
    if (!d.length && !a.length) push('same', '');
  }
  return blocks;
}
