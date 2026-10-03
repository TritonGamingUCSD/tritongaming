// How strikes are counted and named. Safe to import from client components.
// The first mark on someone's record is a WARNING; it counts like a strike, so the limit is 4 marks: a warning, then strikes 1, 2 and 3.
// "At the limit" means 3 strikes (on top of the warning). The oldest mark is the warning, so when it is removed the next oldest becomes it.
export const STRIKES_AT_LIMIT = 3;
export const STRIKE_LIMIT = STRIKES_AT_LIMIT + 1;

// "No strikes", "Warning", "1 strike", "2 strikes", "3 strikes".
export const countLabel = (marks: number) => (marks <= 0 ? 'No strikes' : marks === 1 ? 'Warning' : `${marks - 1} strike${marks === 2 ? '' : 's'}`);

// Names the marks currently on a record, oldest first: Warning, Strike 1, Strike 2, ... (rows must be the active ones, in that order).
export function markLabels(activeOldestFirst: { id: string }[]): Map<string, string> {
  return new Map(activeOldestFirst.map((r, i) => [r.id, i === 0 ? 'Warning' : `Strike ${i}`]));
}
