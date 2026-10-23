import type { KeyboardEvent } from 'react';

// Keyboard movement between cells, like a spreadsheet: Tab goes to the next cell along the row (Shift+Tab back), Enter to the cell below in the same column (Shift+Enter above). The next cell is
// found on the screen, so it works for tables and grids alike; the box being left saves as usual, and the next one opens like a click (also on a touch screen).
let jumping = false;
export const isJumping = () => jumping;
const visible = (el: HTMLElement) => el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"]');
export function moveFrom(from: HTMLElement, e: KeyboardEvent): boolean {
  const back = e.shiftKey;
  const scope = from.closest('[role="dialog"]') ?? document;
  const all = [...scope.querySelectorAll<HTMLElement>('[data-cell]')].filter((el) => el === from || visible(el));
  const i = all.indexOf(from);
  const me = from.getBoundingClientRect();
  let target: HTMLElement | undefined;
  if (e.key === 'Tab') target = all[i + (back ? -1 : 1)];
  else {
    const cx = (me.left + me.right) / 2;
    let best = Infinity;
    for (const el of all) {
      if (el === from) continue;
      const r = el.getBoundingClientRect();
      const gap = back ? me.top - r.bottom : r.top - me.bottom;
      if (gap < -2 || cx < r.left - 4 || cx > r.right + 4 || gap >= best) continue;
      best = gap; target = el;
    }
  }
  if (!target) return false;
  const go = target;
  e.preventDefault();
  requestAnimationFrame(() => { jumping = true; go.click(); jumping = false; });
  return true;
}
export const isMove = (e: KeyboardEvent) => e.key === 'Enter' || e.key === 'Tab';


// On a touch screen (or a narrow one) a stray tap while scrolling or aiming would open a text box, so the first tap only marks the control (outlined, see [data-armed] in the CSS) and a second tap within
// 3 seconds opens it. With a mouse on a wide screen one click opens. Keyboard jumps (Tab, Enter) open at once. `e.currentTarget` carries the mark, so this needs no state and works in any list.
export function tapTwice(e: { currentTarget: HTMLElement }, open: () => void) {
  const el = e.currentTarget;
  const touch = window.matchMedia('(pointer: coarse), (max-width: 899px)').matches;
  if (jumping || !touch || el.hasAttribute('data-armed')) { el.removeAttribute('data-armed'); open(); return; }
  el.setAttribute('data-armed', '');
  setTimeout(() => el.removeAttribute('data-armed'), 3000);
}
