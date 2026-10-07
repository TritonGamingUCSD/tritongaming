import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/portal/capabilities';
import { strictUser } from '@/lib/supabase/localAuth';

// The whole point of this route: nobody managing the portal should need to
// know what a Google Forms "entry ID" even is. Given a plain form URL, it
// fetches the form's own public page and reads its embedded
// FB_PUBLIC_LOAD_DATA_ blob — the same structured data Google's own form
// renderer uses client-side to draw the questions — and returns each
// question's title, entry ID, and (for multiple choice/dropdown) its exact
// option text. This is a read-only GET of the form's public page; nothing
// is ever submitted to it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase
    .from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_events')) {
    return NextResponse.json({ error: 'Event management access required' }, { status: 403 });
  }

  const { form_url } = await request.json() as { form_url?: string };
  if (!form_url?.trim()) return NextResponse.json({ error: 'Missing form_url' }, { status: 400 });

  let html: string;
  try {
    const res = await fetch(form_url.trim(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TritonGamingBot/1.0; +https://tritongaming.org)' },
    });
    if (!res.ok) return NextResponse.json({ error: `Form URL returned ${res.status} — double-check the link.` }, { status: 400 });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: 'Could not reach that URL.' }, { status: 400 });
  }

  const marker = 'FB_PUBLIC_LOAD_DATA_ = ';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    return NextResponse.json({ error: "Couldn't find form data on that page — is it a public Google Form link?" }, { status: 400 });
  }
  const arrStart = html.indexOf('[', markerIdx);
  const jsonText = extractBalancedJson(html, arrStart);
  if (!jsonText) {
    return NextResponse.json({ error: "Found the form data but couldn't parse it." }, { status: 400 });
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return NextResponse.json({ error: "Found the form data but couldn't parse it." }, { status: 400 });
  }

  const questions = parseQuestions(data);
  return NextResponse.json({ questions });
}

// Walks forward from `startIdx` (which must point at a `[`) counting
// bracket depth, correctly skipping over brackets that appear inside
// quoted strings — a naive regex terminated at the first `];` risks
// stopping early if any question/option text happens to contain one.
function extractBalancedJson(text: string, startIdx: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

interface DetectedQuestion {
  title: string;
  entryId: string;
  options: string[] | null;
}

// Reverse-engineered shape of FB_PUBLIC_LOAD_DATA_ (undocumented by Google,
// but stable enough that this is the same structure every public form
// exposes): data[1][1] is the question list; each question is
// [fieldId, title, helpText, type, [[entryId, options|null, required, ...]], ...].
// type 0/1 = short/paragraph text (no options); type 2ish = choice-based
// (options present). Anything with no entry ID at all (section headers,
// images) is skipped.
function parseQuestions(data: unknown): DetectedQuestion[] {
  try {
    const arr = data as unknown[];
    const questionsRaw = (arr[1] as unknown[])[1] as unknown[][];
    return questionsRaw
      .map((q): DetectedQuestion | null => {
        const title = q[1] as string;
        const entryBlock = (q[4] as unknown[][] | null)?.[0];
        const entryId = entryBlock?.[0];
        if (!entryBlock || entryId == null || !title) return null;
        const rawOptions = entryBlock[1] as unknown[][] | null;
        const options = rawOptions
          ? rawOptions.map((o) => o[0] as string).filter((t) => t && t.trim())
          : null;
        return { title, entryId: String(entryId), options: options && options.length > 0 ? options : null };
      })
      .filter((q): q is DetectedQuestion => q !== null);
  } catch {
    return [];
  }
}
