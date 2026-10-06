// A role's color works as a fill or border in either theme, but as text it can vanish (yellow on paper, pale green on cream).
// This mixes it toward the page's ink color so a label stays readable in light and dark.
export const roleInk = (color: string): string => `color-mix(in srgb, ${color} 55%, var(--pp-ink))`;
