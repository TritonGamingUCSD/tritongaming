// The colours a doc's text can have. A fixed palette (never a free colour) so every colour stays readable on both the light and the dark portal, and so a
// doc can only ever contain these few safe values. Stored in a doc as inline HTML (`<span data-c="red">text</span>`, `<mark data-h="yellow">text</mark>`),
// which stays plain text everywhere else. The colour values themselves are CSS variables (--dc-<key>, --dh-<key>) defined in globals.css for each theme.
export const TEXT_COLORS = [
  { key: 'red', label: 'Red' }, { key: 'orange', label: 'Orange' }, { key: 'gold', label: 'Gold' }, { key: 'green', label: 'Green' },
  { key: 'teal', label: 'Teal' }, { key: 'blue', label: 'Blue' }, { key: 'purple', label: 'Purple' }, { key: 'pink', label: 'Pink' }, { key: 'gray', label: 'Gray' },
] as const;
export const HIGHLIGHTS = [
  { key: 'yellow', label: 'Yellow' }, { key: 'green', label: 'Green' }, { key: 'blue', label: 'Blue' },
  { key: 'pink', label: 'Pink' }, { key: 'orange', label: 'Orange' }, { key: 'gray', label: 'Gray' },
] as const;
export const TEXT_COLOR_KEYS: ReadonlySet<string> = new Set(TEXT_COLORS.map((c) => c.key));
export const HIGHLIGHT_KEYS: ReadonlySet<string> = new Set(HIGHLIGHTS.map((c) => c.key));
