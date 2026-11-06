// Pages that save straight to the database are refused by it, and a refused save cannot log itself. This tells the server what was refused so the admin's log has it, and gives back the line the admins want people to see (empty when none).
export async function reportRefusal(area: 'profiles' | 'content', fields: Record<string, string | null | undefined>): Promise<string> {
  try {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) if (v) clean[k] = v;
    const r = await fetch('/api/wordfilter/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area, fields: clean }) });
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    return j.message ? ` ${j.message}` : '';
  } catch {
    return '';
  }
}
