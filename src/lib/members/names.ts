// What a person is called where. display_name is theirs to change (a nickname, first name only, whatever
// they are happy to have on the public Team page). The name from their Google account is kept in
// google_first_name / google_last_name and is never shown publicly.
//
// staffName: for lists where exec need to find a real person (meeting invites, attendance, exports,
// search). "Kiiro (Jasper Huang)": the name they chose first, their real (Google) name in brackets when it differs.
// With `{ tag: true }` (the pickers where someone chooses a person) their gamer tag follows in quotes, so two people with the same name can be told apart:
// `Kiiro (Jasper Huang) "KiiroTag"`. It is left off when the name already says it.
type NameFields = { display_name?: string | null; google_first_name?: string | null; google_last_name?: string | null; gamer_tag?: string | null };
const clean = (s: string | null | undefined) => (s ?? '').trim();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function staffName(p: NameFields, opts?: { tag?: boolean }): string {
  const base = baseName(p);
  const tag = clean(p.gamer_tag);
  if (!opts?.tag || !tag || base.toLowerCase().includes(tag.toLowerCase())) return base;
  return `${base} "${tag}"`;
}

function baseName(p: NameFields): string {
  const shown = clean(p.display_name);
  const real = [clean(p.google_first_name), clean(p.google_last_name)].filter(Boolean).join(' ');
  if (!real) return shown || 'Unnamed';
  if (!shown || same(shown, real) || same(shown, clean(p.google_first_name))) return real;
  return `${shown} (${real})`;
}
