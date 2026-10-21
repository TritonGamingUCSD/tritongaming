// True when a click landed on (or inside) something that has its own job (a button, a box, a link, a field), so a click on a whole row that opens or folds it can leave it alone.
export const interactive = (target: EventTarget | null): boolean => target instanceof Element && !!target.closest('button, a, input, select, textarea, label, summary, details');
