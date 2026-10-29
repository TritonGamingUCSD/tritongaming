import { showToast } from '@/lib/ui/toast';

// Ctrl+Z / Cmd+Z for cell edits in Logistics. Every edit made in a cell records how to put the old value back (the same save the cell itself uses) and how to make the change again; Ctrl+Z runs the
// last one, Ctrl+Shift+Z (or Ctrl+Y) redoes it. The list is kept in memory only, so it starts empty each time Logistics opens, and a new edit clears what could be redone.
interface Entry {
  undo: () => void;
  redo: () => void;
}
const past: Entry[] = [];
let future: Entry[] = [];

export function recordEdit(undo: () => void, redo: () => void) {
  past.push({ undo, redo });
  if (past.length > 50) past.shift();
  future = [];
}
export function clearEdits() {
  past.length = 0;
  future = [];
}

export function undoEdit(): boolean {
  const e = past.pop();
  if (!e) return false;
  future.push(e);
  e.undo();
  showToast('Undone');
  return true;
}
export function redoEdit(): boolean {
  const e = future.pop();
  if (!e) return false;
  past.push(e);
  e.redo();
  showToast('Redone');
  return true;
}

// The key handler: while a text box has the focus the browser's own undo of the typing is left alone.
export function onUndoKey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k !== 'z' && k !== 'y') return;
  const t = e.target as HTMLElement | null;
  if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]'))) return;
  const redo = k === 'y' || e.shiftKey;
  if (redo ? redoEdit() : undoEdit()) e.preventDefault();
}
