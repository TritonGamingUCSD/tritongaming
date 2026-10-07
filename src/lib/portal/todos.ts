import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { listInternalEvents } from '@/lib/meetings/internalEvents';
import { loadPlanViews } from '@/lib/meetings/meetingPlanServer';
import { dayLabel } from '@/lib/meetings/meetingPlans';

// Things waiting on this person, shown together at the top of the portal home so nobody has to go looking for them.
export interface TodoItem {
  id: string;
  /** What to do, as a sentence. */
  text: string;
  /** Extra line (when, who). */
  detail?: string;
  href: string;
  /** 'urgent' items (happening today, people waiting on you) are shown first and stand out. */
  tone: 'urgent' | 'normal';
}

const PLAN_HREF = (id: string) => `/portal/meetings/planning?plan=${id}`;

// Meeting plans that need me (my availability, or, for a host, a time to pick) and internal events I haven't answered. The other
// to-dos (help replies, an event to check in today, a meeting on now) are already known by the page and added there.
export async function loadTodos(
  svc: SupabaseClient,
  user: { id: string; roles: { role: string; division_id?: string | null }[] },
  opts: { manageAll: boolean; canHost: boolean; canViewInternalEvents: boolean },
): Promise<TodoItem[]> {
  const out: TodoItem[] = [];
  const today = pacificDayKey();

  try {
    const plans = await loadPlanViews({ user, svc, manageAll: false, canHost: opts.canHost, roles: user.roles });
    for (const p of plans) {
      if (p.status !== 'open') continue;
      const asked = p.people.some((x) => x.id === user.id);
      if (asked && !p.expired && !p.responses[user.id]) {
        out.push({ id: `plan-fill-${p.id}`, text: `Add your availability to “${p.title}”`, detail: p.answer_by ? `Answer by ${new Date(`${p.answer_by}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}` : `${p.people.filter((x) => p.responses[x.id]).length} of ${p.people.length} have answered`, href: PLAN_HREF(p.id), tone: p.answer_by && p.answer_by <= today ? 'urgent' : 'normal' });
      }
      if (p.isHost) {
        if (p.expired) out.push({ id: `plan-expired-${p.id}`, text: `Pick new dates for “${p.title}”`, detail: 'Every day of the plan has passed', href: PLAN_HREF(p.id), tone: 'normal' });
        else {
          const waiting = p.people.filter((x) => x.id !== p.host_id && !p.responses[x.id]).length;
          if (waiting === 0 && Object.keys(p.responses).length > 0) out.push({ id: `plan-ready-${p.id}`, text: `Everyone answered “${p.title}”. Pick a time`, href: PLAN_HREF(p.id), tone: 'normal' });
        }
      }
    }
  } catch { /* the rest of the list still shows */ }

  if (opts.canViewInternalEvents) {
    try {
      const events = await listInternalEvents(svc, user, opts.manageAll, 'invited');
      const horizon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      for (const e of events.filter((x) => !x.hosting && x.mine === null && x.date <= horizon)) {
        out.push({ id: `rsvp-${e.id}`, text: `RSVP to “${e.title}”`, detail: dayLabel(e.date, 'once'), href: '/portal/internal-events', tone: e.date === today ? 'urgent' : 'normal' });
      }
    } catch { /* ignore */ }
  }
  return out;
}
