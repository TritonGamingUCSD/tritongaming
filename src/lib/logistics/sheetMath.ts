// The plain logic of the spreadsheet view (components/Sheet.tsx in Logistics): reading what was typed into a cell, comparing for sort, and the filter boxes. No React, no database.

export type CellValue = string | number | boolean | null;
export type CellKind = 'text' | 'number' | 'money' | 'select' | 'bool' | 'date' | 'photo' | 'readonly';

// What was typed into a cell, as the value to save. Returns `error` in words when it cannot be used.
export function parseCell(kind: CellKind, raw: string, nullable: boolean): { value: CellValue } | { error: string } {
  const text = raw.trim();
  if (kind === 'number' || kind === 'money') {
    if (!text) return nullable ? { value: null } : { error: 'Type a number.' };
    const n = Number(text.replace(/[$,]/g, ''));
    if (!Number.isFinite(n)) return { error: 'That isn’t a number.' };
    if (kind === 'money' && n < 0) return { error: 'The price can’t be negative.' };
    return { value: kind === 'money' ? Math.round(n * 100) / 100 : Math.round(n) };
  }
  if (kind === 'date') {
    if (!text) return nullable ? { value: null } : { error: 'Pick a date.' };
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { value: text } : { error: 'Use a date like 2026-10-31.' };
  }
  if (!text && !nullable && kind !== 'text') return { error: 'Choose a value.' };
  return { value: text || (nullable ? null : '') };
}

// Sorting: numbers by value, text by its letters (numbers inside text in order: "TECM 2" before "TECM 10"), empty cells always last.
export function compareCells(a: CellValue, b: CellValue, dir: 1 | -1): number {
  const empty = (v: CellValue) => v === null || v === '' || v === undefined;
  if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : empty(a) ? 1 : -1;   // empties last whichever way it runs
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
  if (typeof a === 'boolean' && typeof b === 'boolean') return (Number(a) - Number(b)) * dir;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }) * dir;
}

// The filter box of a column: text means "contains" (capitals ignored); for numbers `>5`, `<3`, `>=2`, `<=2`, `=0` or a plain number; for yes/no columns yes, no, y, n or a tick.
export function matchesFilter(kind: CellKind, value: CellValue, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (kind === 'bool') { const yes = /^(y|yes|x|true|✓|✔)$/.test(q), no = /^(n|no|false)$/.test(q); return yes ? value === true : no ? value === false : true; }
  if ((kind === 'number' || kind === 'money') && /^(>=|<=|>|<|=)?\s*-?\d+(\.\d+)?$/.test(q)) {
    const m = /^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/.exec(q)!;
    const n = Number(m[2]), v = typeof value === 'number' ? value : value === null || value === '' ? NaN : Number(value);
    if (Number.isNaN(v)) return false;
    switch (m[1]) { case '>': return v > n; case '<': return v < n; case '>=': return v >= n; case '<=': return v <= n; default: return v === n; }
  }
  if (q === '-' || q === 'empty') return value === null || value === '' || value === undefined;
  return String(value ?? '').toLowerCase().includes(q);
}
