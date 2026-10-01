import type { AppRole } from '@/types/database';

// Matches how the CMS's kvlist field stores rows (see ContentEditor.tsx) —
// `value` is the left/key column, `label` is the right/value column.
type KvRow = { value?: string; label?: string };

export interface CheckinFormConfig {
  form_url?: string;
  entry_event_name?: string;
  entry_academic_year?: string;
  entry_affiliation?: string;
  entry_food_item?: string;
  // The year question's own options as read from the form (Class of ‘27 ...).
  // With a person's graduation year these are matched directly, so nobody has to
  // re-map "3rd Year" -> option each fall; year_mapping is the fallback.
  year_options?: string[];
  year_mapping?: KvRow[];
  affiliation_mapping?: KvRow[];
}

// Same precedence as every other "which single role represents this
// person" list in the codebase (MembersSectionContent, BoardSection) —
// picks the highest-ranked role someone holds so a co-officer/exec still
// maps to their most senior affiliation rather than whichever role
// happened to come back first from the DB.
const ROLE_ORDER: AppRole[] = ['exec', 'lead', 'officer', 'division', 'alumni', 'recruit', 'admin', 'ucsd'];

// Finds the form option for a graduation year by its trailing two digits, so
// "Class of ‘27", "Class of '27" and "Class of 2027" all match 2027 - returning
// the option's exact text (curly quote and all), which is what prefill needs.
function matchClassOption(options: string[] | undefined, classOf: number): string | undefined {
  const yy = String(classOf % 100).padStart(2, '0');
  return options?.find((o) => /(\d{2})\D*$/.exec(o)?.[1] === yy);
}

function lookup(mapping: KvRow[] | undefined, key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return mapping?.find((row) => row.value === key)?.label;
}

// Builds the pre-filled, embeddable UCSD check-in form URL for one
// attendee/event, or null if the form isn't configured at all (nothing to
// show). Any field without a mapped entry ID or a matching mapping row is
// just left blank in the form — the attendee fills that one in themselves
// rather than the whole form failing to render. Deliberately NOT
// `embedded=true`: the form opens in its own tab now (an embedded copy can't
// work — see the AS Form step), and that flag only adds a cookie wall /
// sign-in bounce to the page.
//
// The event question is a pick-list of every club's events on UCSD's form
// ("Org - Event name"), so `eventTitle` must be that option's exact text to
// preselect it — the per-event "Event on AS Form" setting holds it. A value
// that matches no option is simply ignored by Google (left for the attendee
// to pick).
export function buildCheckinFormUrl(
  config: CheckinFormConfig,
  opts: { eventTitle: string; year: string | null; classOf?: number | null; roles: AppRole[]; foodItem: string | null }
): string | null {
  if (!config.form_url?.trim()) return null;

  // Parsed as a real URL (not string-concatenated with a bare `?`) so this
  // is safe no matter what an admin pasted — a share link commonly already
  // has its own query string attached (?usp=sf_link, ?pli=1, etc.), and
  // blindly appending a second `?` produces a malformed URL Google's own
  // servers reject with a flat "400 — that's all we know" rather than
  // something that points at the actual problem.
  let url: URL;
  try {
    url = new URL(config.form_url.trim());
  } catch {
    return null;
  }

  if (config.entry_event_name) {
    url.searchParams.set(`entry.${config.entry_event_name}`, opts.eventTitle);
  }
  if (config.entry_academic_year) {
    const mapped = (opts.classOf ? matchClassOption(config.year_options, opts.classOf) : undefined) ?? lookup(config.year_mapping, opts.year);
    if (mapped) url.searchParams.set(`entry.${config.entry_academic_year}`, mapped);
  }
  if (config.entry_affiliation) {
    const primaryRole = ROLE_ORDER.find((r) => opts.roles.includes(r));
    const mapped = lookup(config.affiliation_mapping, primaryRole);
    if (mapped) url.searchParams.set(`entry.${config.entry_affiliation}`, mapped);
  }
  if (config.entry_food_item && opts.foodItem) {
    url.searchParams.set(`entry.${config.entry_food_item}`, opts.foodItem);
  }

  return url.toString();
}
