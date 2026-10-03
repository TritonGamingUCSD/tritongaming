// What a person is called where. display_name is theirs to change (a nickname, first name only, whatever
// they are happy to have on the public Team page). The name from their Google account is kept in
// google_first_name / google_last_name and is never shown publicly.
//
// staffName: for lists where exec need to find a real person (meeting invites, attendance, exports,
// search). "Kiiro (Jasper Huang)": the name they chose first, their real (Google) name in brackets when it differs.
type NameFields = { display_name?: string | null; google_first_name?: string | null; google_last_name?: string | null };
const clean = (s: string | null | undefined) => (s ?? '').trim();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function staffName(p: NameFields): string {
  const shown = clean(p.display_name);
  const real = [clean(p.google_first_name), clean(p.google_last_name)].filter(Boolean).join(' ');
  if (!real) return shown || 'Unnamed';
  if (!shown || same(shown, real) || same(shown, clean(p.google_first_name))) return real;
  return `${shown} (${real})`;
}
