// The colors a division can use for its accent (a thin line in the portal, highlights on its public page). A fixed palette, so every choice has enough contrast on the portal's navy and on the paper
// background and nothing can look broken. A division stores the palette key in `divisions.accent`; with none chosen it uses the Triton Gaming yellow. Plain data and pure functions.
export interface Accent {
  key: string;
  label: string;
  hex: string;
}
export const ACCENTS: readonly Accent[] = [
  { key: 'yellow', label: 'Yellow', hex: '#ffc72c' },
  { key: 'orange', label: 'Orange', hex: '#f08a24' },
  { key: 'red', label: 'Red', hex: '#e0533f' },
  { key: 'pink', label: 'Pink', hex: '#e870a8' },
  { key: 'purple', label: 'Purple', hex: '#8b6cdc' },
  { key: 'indigo', label: 'Indigo', hex: '#5a67d8' },
  { key: 'blue', label: 'Blue', hex: '#3c7fd0' },
  { key: 'sky', label: 'Sky', hex: '#4fb3e8' },
  { key: 'teal', label: 'Teal', hex: '#2fae86' },
  { key: 'green', label: 'Green', hex: '#5dbb46' },
  { key: 'lime', label: 'Lime', hex: '#b4cf3a' },
  { key: 'slate', label: 'Slate', hex: '#9aa7bd' },
];
export const DEFAULT_ACCENT = ACCENTS[0];

export const accentOf = (key: string | null | undefined): Accent => ACCENTS.find((a) => a.key === key) ?? DEFAULT_ACCENT;

/** The palette color closest to a picture's color (red, green, blue 0 to 255). */
export function nearestAccent(r: number, g: number, b: number): Accent {
  let best = DEFAULT_ACCENT;
  let bestD = Infinity;
  for (const a of ACCENTS) {
    const ar = parseInt(a.hex.slice(1, 3), 16),
      ag = parseInt(a.hex.slice(3, 5), 16),
      ab = parseInt(a.hex.slice(5, 7), 16);
    // weighted distance: the eye is most sensitive to green, least to blue
    const d = 2 * (r - ar) ** 2 + 4 * (g - ag) ** 2 + 3 * (b - ab) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
