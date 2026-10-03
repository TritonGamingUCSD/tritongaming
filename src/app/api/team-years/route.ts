import { NextResponse } from 'next/server';
import { pacificDayKey } from '@/lib/checkinDays';
import { academicYearLabel, authorizeQuarters, currentQuarter, loadQuarters } from '@/lib/quarters';
import { alumniCandidates, autoAlumniOn, buildYear } from '@/lib/teamYears';

export const dynamic = 'force-dynamic';

// Every academic year's list (the recorded one, or for a year not yet archived the one worked out from its quarters so far), plus the graduates ready
// to move to Alumni. Exec and admins can read; only admins change anything.
export async function GET() {
  const auth = await authorizeQuarters('manage');
  if (auth.error) return auth.error;
  const quarters = await loadQuarters(auth.svc);
  const today = pacificDayKey();
  const { data: stored } = await auth.svc.from('team_years').select('start_year, archived_at, auto');
  const { data: members } = await auth.svc.from('team_year_members').select('id, start_year, user_id, name, title, tier, avatar_url, manual').order('name');
  const years = [...new Set([...quarters.map((q) => q.start_year), ...(stored ?? []).map((s) => s.start_year as number)])].sort((a, b) => b - a);
  const out = [];
  for (const y of years) {
    const row = (stored ?? []).find((s) => s.start_year === y);
    const list = row ? (members ?? []).filter((m) => m.start_year === y) : (await buildYear(auth.svc, y)).map((m) => ({ id: null, start_year: y, ...m, manual: false }));
    out.push({ start_year: y, label: academicYearLabel(y), archived: !!row, archived_at: row?.archived_at ?? null, auto: row?.auto ?? null, members: list });
  }
  const cur = currentQuarter(quarters, today);
  return NextResponse.json({ canEdit: auth.canSetup, currentYear: cur?.start_year ?? null, years: out, candidates: await alumniCandidates(auth.svc, today), autoAlumni: await autoAlumniOn(auth.svc) });
}
