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
  { name: 'Chemical Engineering', field: 'Engineering & Computing', aliases: ['chem eng', 'chemical eng', 'chen'] },
  { name: 'Data Science', field: 'Engineering & Computing', aliases: ['ds', 'data sci', 'datasci'] },
  { name: 'Math-Computer Science', field: 'Engineering & Computing', aliases: ['mathcs', 'math cs', 'math comp sci', 'mathematics computer science', 'math-cs'] },
  { name: 'Information Systems', field: 'Engineering & Computing', aliases: ['info sys', 'is'] },
  { name: 'Cognitive Science', field: 'Social Sciences', aliases: ['cogsci', 'cog sci', 'cog-sci', 'cognitive sci', 'cogs', 'cogsci hci', 'cognitive science hci', 'cogsci machine learning', 'cogsci ml'] },
  { name: 'Mathematics', field: 'Sciences', aliases: ['math', 'maths', 'applied math', 'applied mathematics', 'pure math'] },
  { name: 'Probability & Statistics', field: 'Sciences', aliases: ['stats', 'statistics', 'prob stats', 'probability and statistics', 'math stats'] },
  { name: 'Physics', field: 'Sciences', aliases: ['phys', 'applied physics', 'astrophysics'] },
  { name: 'Chemistry', field: 'Sciences', aliases: ['chem', 'chemistry biochemistry', 'chem/biochem'] },
  { name: 'Biochemistry', field: 'Life Sciences', aliases: ['biochem', 'bioc', 'biochemistry and cell biology', 'biochem cell bio'] },
  { name: 'Biology', field: 'Life Sciences', aliases: ['bio', 'general biology', 'molecular biology', 'molecular and cell biology', 'mcb', 'human biology', 'cell biology', 'microbiology', 'ecology evolution', 'eebe', 'biology: general'] },
  { name: 'Neuroscience', field: 'Life Sciences', aliases: ['neuro', 'neurosci', 'neurobiology', 'physiology and neuroscience', 'physiology neuroscience'] },
  { name: 'Public Health', field: 'Life Sciences', aliases: ['pubh', 'public health', 'global health', 'biomedical sciences', 'pre-med', 'premed', 'pre med'] },
  { name: 'Psychology', field: 'Social Sciences', aliases: ['psych', 'psyc', 'clinical psychology', 'developmental psychology', 'psychology (social)'] },
  { name: 'Economics', field: 'Social Sciences', aliases: ['econ', 'eco', 'econs', 'managerial economics', 'econ and math', 'economics and mathematics'] },
  { name: 'Management Science', field: 'Social Sciences', aliases: ['mgt', 'business', 'business econ', 'business economics', 'management', 'ms', 'managerial sci'] },
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
  { name: 'Environmental Systems', field: 'Sciences', aliases: ['envr sys', 'environmental science', 'env sci', 'environment', 'earth sciences', 'marine biology', 'oceanography'] },
  { name: 'Undeclared', field: 'Undeclared', aliases: ['undeclared', 'undecided', 'unknown', 'n/a', 'na', 'none', 'idk', 'exploring', 'tbd', 'ud', 'undeclared engineering', 'undeclared sciences', 'undeclared social sciences'] },
];

const FILLER = /\b(b\.?\s?[sa]\.?|bachelors?|bachelor of (science|arts)|major|majoring in|majoring|degree|in|program|minor)\b/g;
const norm = (s: string) => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/\(.*?\)/g, ' ').replace(FILLER, ' ').replace(/[^a-z0-9&\-/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s: string) => norm(s).replace(/[-/]/g, ' ').replace(/\s+/g, ' ').trim();

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

const titleCase = (s: string) => s.replace(/\b([a-z])([a-z']*)/gi, (_, f, r) => f.toUpperCase() + r.toLowerCase());

function resolveOne(part: string): { name: string; field: string } | null {
  const k = key(part);
  if (!k) return null;
  const exact = LOOKUP.get(k);
  if (exact) return exact;
  // Typos: only for reasonably long strings, and only one clear winner.
  if (k.length >= 6) {
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
    if (best && !tie) return best.c;
  }
  // "Computer Science and ..." style prefixes with extra words: match a known name contained in the text.
  for (const c of CANON) if (k.length > c.name.length && k.startsWith(key(c.name) + ' ')) return c;
  return { name: titleCase(part.trim().replace(/\s+/g, ' ')), field: 'Other' };
}

// "CS / Math", "Cognitive Science & Economics", "CS, DS", "cs and math" → each major separately.
function splitMajors(raw: string): string[] {
  const text = raw.replace(/\b(double major|dual major|double|dual)\b[:\s]*(in|of)?/gi, ' ').trim();
  // Names that legitimately contain a separator stay whole.
  if (LOOKUP.has(key(text))) return [text];
  return text.split(/\s*(?:[\/,;+&]|\band\b|\bw\/\b|\bwith\b)\s*/i).map((p) => p.trim()).filter(Boolean);
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
