// Free-text majors ("CS", "comp sci", "Cognitive Science & Math") are messy, so
// analytics run them through this first: split double majors, expand common
// abbreviations, snap near-misses/typos to a canonical name, and tag a broad
// field of study. Unknown majors are kept (tidied), never dropped.

interface Canon { name: string; field: string; aliases: string[] }

const CANON: Canon[] = [
  { name: 'Computer Science', field: 'Engineering & Computing', aliases: ['cs', 'comp sci', 'compsci', 'cse', 'computer science and engineering', 'computer science engineering', 'computer sci', 'computer science b.s.', 'cs25', 'cs26', 'cs27', 'cs28'] },
  { name: 'Computer Engineering', field: 'Engineering & Computing', aliases: ['ce', 'cpe', 'comp eng', 'compe', 'computer eng'] },
  { name: 'Electrical Engineering', field: 'Engineering & Computing', aliases: ['ee', 'elec eng', 'electrical eng'] },
  { name: 'Mechanical Engineering', field: 'Engineering & Computing', aliases: ['mae', 'me', 'mech eng', 'mechanical eng'] },
  { name: 'Aerospace Engineering', field: 'Engineering & Computing', aliases: ['aero', 'aerospace', 'aero eng'] },
  { name: 'Structural Engineering', field: 'Engineering & Computing', aliases: ['se', 'structural eng'] },
  { name: 'Bioengineering', field: 'Engineering & Computing', aliases: ['bioeng', 'bioe', 'be', 'bio eng', 'biomedical engineering'] },
  { name: 'NanoEngineering', field: 'Engineering & Computing', aliases: ['nanoeng', 'nano eng', 'nanoengineering'] },
  { name: 'Chemical Engineering', field: 'Engineering & Computing', aliases: ['chem eng', 'chem engineering', 'chemical eng', 'chen'] },
  { name: 'Data Science', field: 'Engineering & Computing', aliases: ['ds', 'data sci', 'datasci'] },
  { name: 'Math-Computer Science', field: 'Engineering & Computing', aliases: ['mathcs', 'math cs', 'math comp sci', 'mathematics computer science', 'math-cs'] },
  { name: 'Information Systems', field: 'Engineering & Computing', aliases: ['info sys', 'is'] },
  { name: 'Cognitive Science', field: 'Social Sciences', aliases: ['cogsci', 'cog sci', 'cog-sci', 'cognitive sci', 'cogs', 'cogsci hci', 'cognitive science hci', 'cogsci machine learning', 'cogsci ml'] },
  { name: 'Mathematics', field: 'Sciences', aliases: ['math', 'maths', 'applied math', 'applied mathematics', 'pure math'] },
  { name: 'Probability & Statistics', field: 'Sciences', aliases: ['stats', 'statistics', 'prob stats', 'probability and statistics', 'math stats'] },
  { name: 'Physics', field: 'Sciences', aliases: ['phys', 'applied physics', 'astrophysics', 'astrophysics and astronomy'] },
  { name: 'Chemistry', field: 'Sciences', aliases: ['chem', 'chemistry biochemistry', 'chem/biochem'] },
  { name: 'Biochemistry', field: 'Life Sciences', aliases: ['biochem', 'bioc', 'biochemistry and cell biology', 'biochem cell bio'] },
  { name: 'Biology', field: 'Life Sciences', aliases: ['bio', 'general biology', 'molecular biology', 'human biology', 'microbiology', 'ecology evolution', 'eebe', 'biology: general'] },
  { name: 'Neuroscience', field: 'Life Sciences', aliases: ['neuro', 'neurosci', 'neurobiology', 'physiology and neuroscience', 'physiology neuroscience'] },
  { name: 'Public Health', field: 'Life Sciences', aliases: ['pubh', 'public health', 'global health', 'biomedical sciences', 'pre-med', 'premed', 'pre med'] },
  { name: 'Psychology', field: 'Social Sciences', aliases: ['psych', 'psyc', 'clinical psychology', 'developmental psychology', 'psychology (social)'] },
  { name: 'Economics', field: 'Social Sciences', aliases: ['econ', 'econs', 'managerial economics', 'econ and math', 'economics and mathematics'] },
  { name: 'Management Science', field: 'Social Sciences', aliases: ['mgt', 'business', 'business econ', 'biz econ', 'business economics', 'management', 'ms', 'managerial sci'] },
  { name: 'Political Science', field: 'Social Sciences', aliases: ['poli sci', 'polisci', 'pol sci', 'political sci', 'international studies', 'intl studies'] },
  { name: 'Sociology', field: 'Social Sciences', aliases: ['soc', 'socio'] },
  { name: 'Communication', field: 'Social Sciences', aliases: ['comm', 'communications', 'comms'] },
  { name: 'Education Studies', field: 'Social Sciences', aliases: ['edu', 'education', 'ed studies'] },
  { name: 'Linguistics', field: 'Humanities & Arts', aliases: ['ling', 'language studies', 'linguistics and cognitive science'] },
  { name: 'Visual Arts', field: 'Humanities & Arts', aliases: ['art', 'arts', 'studio art', 'visual art', 'media', 'media arts', 'ica', 'interdisciplinary computing and the arts', 'interdisciplinary computing & the arts', 'design', 'graphic design'] },
  { name: 'Music', field: 'Humanities & Arts', aliases: ['music', 'music composition'] },
  { name: 'Literature', field: 'Humanities & Arts', aliases: ['lit', 'english', 'literature writing', 'creative writing'] },
  { name: 'History', field: 'Humanities & Arts', aliases: ['hist'] },
  { name: 'Philosophy', field: 'Humanities & Arts', aliases: ['phil', 'philo'] },
  { name: 'Environmental Systems', field: 'Sciences', aliases: ['envr sys', 'environmental science', 'env sci', 'environment', 'earth sciences', 'oceanography'] },
  { name: 'Anthropology', field: 'Social Sciences', aliases: ['anthro', 'anthropology'] },
  { name: 'Business Psychology', field: 'Social Sciences', aliases: ['biz psych', 'bus psych'] },
  { name: 'Human Developmental Sciences', field: 'Social Sciences', aliases: ['hdp', 'human development', 'hds'] },
  { name: 'Environmental Engineering', field: 'Engineering & Computing', aliases: ['enviro eng', 'environmental eng'] },
  { name: 'Engineering Physics', field: 'Engineering & Computing', aliases: ['eng phys', 'engineering phys'] },
  { name: 'Film & Media', field: 'Humanities & Arts', aliases: ['film', 'film studies', 'theatre', 'theater', 'theatre and dance'] },
  { name: 'Artificial Intelligence', field: 'Engineering & Computing', aliases: ['ai', 'artificial intelligence'] },
  { name: 'Bioinformatics', field: 'Life Sciences', aliases: ['bioinfo', 'bioinformatics'] },
  { name: 'Ecology, Behavior & Evolution', field: 'Life Sciences', aliases: ['ecology behavior evolution', 'ebe', 'eco', 'ecology'] },
  { name: 'ICAM', field: 'Humanities & Arts', aliases: ['icam', 'interdisciplinary computing and the arts music', 'icam music'] },
  { name: 'Astronomy', field: 'Sciences', aliases: ['astro', 'astronomy and astrophysics', 'astronomy & astrophysics'] },
  { name: 'Literary Arts', field: 'Humanities & Arts', aliases: ['literary arts', 'literary arts creative writing'] },
  { name: 'Urban Studies & Planning', field: 'Social Sciences', aliases: ['urban studies', 'urban studies and planning', 'urban planning'] },
  { name: 'Marine Biology', field: 'Life Sciences', aliases: ['marine bio', 'marine biology'] },
  { name: 'Molecular & Cell Biology', field: 'Life Sciences', aliases: ['mcb', 'mcdb', 'molecular and cell biology', 'molecular cell biology'] },
  { name: 'Undeclared', field: 'Undeclared', aliases: ['undeclared', 'undecided', 'unknown', 'n/a', 'na', 'none', 'idk', 'exploring', 'tbd', 'ud', 'undeclared engineering', 'undeclared sciences', 'undeclared social sciences'] },
];

const FILLER = /\b(b\.?\s?[sa]\.?|bachelors?|bachelor of (science|arts)|major|majoring in|majoring|degree|in|program|minor)\b/g;
const norm = (s: string) => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/\(.*?\)/g, ' ').replace(FILLER, ' ').replace(/[^a-z0-9&\-/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
// "and" ≡ "&", dashes/slashes ≡ spaces, so spelling variants of one name collapse.
const key = (s: string) => norm(s).replace(/\band\b/g, '&').replace(/[-/]/g, ' ').replace(/\s+/g, ' ').trim();

const LOOKUP = new Map<string, Canon>();
for (const c of CANON) {
  LOOKUP.set(key(c.name), c);
  for (const a of c.aliases) LOOKUP.set(key(a), c);
}

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// Acronyms (ICAM, MAE) keep their caps; everything else is Title Cased.
const titleCase = (s: string) => s.replace(/[A-Za-z][A-Za-z']*/g, (w) => (w.length <= 5 && w === w.toUpperCase() && w.length > 1 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));

// Longest known name the text starts with ("cogs ml", "icam music", "cognitive science design").
// Skips very short aliases — "art history" shouldn't become "Visual Arts".
function prefixMatch(k: string): Canon | null {
  let best: { c: Canon; len: number } | null = null;
  for (const [alias, c] of LOOKUP) {
    if (alias.length < 4) continue;
    if (k.startsWith(alias + ' ') && (!best || alias.length > best.len)) best = { c, len: alias.length };
  }
  return best?.c ?? null;
}

function fuzzyMatch(k: string): Canon | null {
  if (k.length < 6) return null;
  let best: { c: Canon; d: number } | null = null;
  let tie = false;
  for (const [alias, c] of LOOKUP) {
    if (alias.length < 5) continue;
    const d = distance(k, alias);
    if (d <= Math.max(1, Math.floor(alias.length / 6))) {
      if (!best || d < best.d) { best = { c, d }; tie = false; }
      else if (d === best.d && c !== best.c) tie = true;
    }
  }
  return best && !tie ? best.c : null;
}

// A recognised major, or null. Tries: exact → typo → "Major - Specialization" /
// "Major: Track" / "Major (Spec)" with the specialization dropped → known prefix.
function resolveKnown(part: string): Canon | null {
  const k = key(part);
  if (!k) return null;
  const hit = LOOKUP.get(k) ?? fuzzyMatch(k);
  if (hit) return hit;
  const head = part.split(/\s+-\s+|:|\(/)[0];
  if (head !== part) {
    const h = resolveKnown(head);
    if (h) return h;
  }
  return prefixMatch(k);
}

// "CS / Math", "Cognitive Science, Economics", "cs and math" → each major
// separately. "/" "," ";" "+" always separate; "&" / "and" / "with" only when
// every piece is a recognised major (so "Molecular & Cell Biology" and
// "Urban Studies and Planning" stay whole).
function splitMajors(raw: string): string[] {
  const text = raw.replace(/\b(double major|dual major|double|dual)\b[:\s]*(in|of)?/gi, ' ').trim();
  if (LOOKUP.has(key(text))) return [text];
  const out: string[] = [];
  for (const hard of text.split(/\s*[\/,;+]\s*/).map((p) => p.trim()).filter(Boolean)) {
    if (LOOKUP.has(key(hard))) { out.push(hard); continue; }
    const soft = hard.split(/\s*(?:&|\band\b|\bw\/\b|\bwith\b)\s*/i).map((p) => p.trim()).filter(Boolean);
    if (soft.length > 1 && soft.every((p) => resolveKnown(p))) out.push(...soft);
    else out.push(hard);
  }
  return out;
}

function resolveOne(part: string): { name: string; field: string } | null {
  if (!key(part)) return null;
  return resolveKnown(part) ?? { name: titleCase(part.trim().replace(/\s+/g, ' ')), field: 'Other' };
}

export interface ParsedMajors { majors: string[]; fields: string[] }

export function parseMajors(raw: string | null | undefined): ParsedMajors {
  if (!raw?.trim()) return { majors: [], fields: [] };
  const seen = new Map<string, string>();
  for (const part of splitMajors(raw)) {
    const r = resolveOne(part);
    if (r && !seen.has(r.name)) seen.set(r.name, r.field);
  }
  return { majors: [...seen.keys()], fields: [...new Set(seen.values())] };
}

// What the profile's major dropdown offers (free text via "Other" is still allowed).
export const MAJOR_OPTIONS: string[] = CANON.map((c) => c.name).filter((n) => n !== 'Undeclared').sort((a, b) => a.localeCompare(b)).concat('Undeclared');

// Joins/splits the stored value ("Computer Science / Mathematics").
export const MAJOR_SEPARATOR = ' / ';
export const MAX_MAJORS = 3;
// Splits only on the picker's own separator (" / "), never a bare "/" — so what
// someone typed before the dropdown existed ("Chem/Biochem", "Cogsci spec. Lang&Cult")
// stays one untouched entry instead of being split up and rewritten.
export function splitStoredMajors(value: string): string[] {
  return value.split(MAJOR_SEPARATOR).map((v) => v.trim()).filter(Boolean);
}

// For tidying stored values without losing anything the person wrote: returns the
// canonical name only when the text is that name (ignoring case, spacing,
// "&"/"and") or a plain abbreviation of it ("CS", "econ", "poli sci"). Anything
// with a specialization, a double major, or that needed guessing returns null.
const SAFE_ABBREVIATIONS = new Set(['cs', 'comp sci', 'compsci', 'cogsci', 'cog sci', 'econ', 'psych', 'poli sci', 'polisci', 'math', 'bio', 'chem', 'biochem', 'ds', 'data sci', 'mcb', 'phys', 'stats', 'neuro', 'ling', 'soc', 'anthro']);
export function canonicalMajorIfSafe(raw: string): string | null {
  if (/[()]/.test(raw)) return null; // "Visual Arts (ICAM)" says more than either name alone
  const k = key(raw);
  if (!k) return null;
  const hit = LOOKUP.get(k);
  if (!hit) return null;
  return k === key(hit.name) || SAFE_ABBREVIATIONS.has(k) ? hit.name : null;
}
