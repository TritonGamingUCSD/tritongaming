import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { strictUser } from '@/lib/supabase/localAuth';
import { BANNER_MAX, DEFAULT_SETTINGS, loadSiteSettings, type CodeStyle } from '@/lib/portal/siteSettings';

export const dynamic = 'force-dynamic';

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Only admins can change site settings.' }, { status: 403 }) };
  return { user, svc: createServiceClient() };
}

// The site-wide settings (Admin → System → Settings). Admin only; every change is written to the audit log with what it was and what it is now.
//   GET                                         the settings
//   POST { setting: 'code_style', value: 'tg' | 'byte' }
//   POST { setting: 'banner', on: boolean, text: string, until: 'YYYY-MM-DD' | '' }
//   POST { setting: 'code_style' | 'banner', reset: true }   back to the default
export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const before = await loadSiteSettings(auth.svc);
  const save = (rows: { key: string; value: string }[]) => auth.svc.from('team_settings').upsert(rows, { onConflict: 'key' });

  if (b.setting === 'code_style') {
    const value: CodeStyle | null = b.reset ? DEFAULT_SETTINGS.codeStyle : b.value === 'tg' || b.value === 'byte' ? b.value : null;
    if (!value) return NextResponse.json({ error: 'Choose TGcode or Bytecode.' }, { status: 400 });
    const { error } = await save([{ key: 'code_style', value }]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    if (value !== before.codeStyle)
      await logAudit(auth.svc, {
        actorId: auth.user.id,
        action: 'update',
        entityType: 'site setting',
        entityId: null,
        summary: `Changed the code everyone shows from ${before.codeStyle === 'byte' ? 'Bytecode' : 'TGcode'} to ${value === 'byte' ? 'Bytecode' : 'TGcode'}`,
        details: { setting: 'code_style', from: before.codeStyle, to: value },
      });
    return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
  }

  if (b.setting === 'banner') {
    const next = b.reset
      ? DEFAULT_SETTINGS.banner
      : { on: b.on === true, text: typeof b.text === 'string' ? b.text.trim().slice(0, BANNER_MAX) : '', until: typeof b.until === 'string' ? b.until : '' };
    if (next.until && !/^\d{4}-\d{2}-\d{2}$/.test(next.until)) return NextResponse.json({ error: 'The last day is not a date.' }, { status: 400 });
    if (next.on && !next.text) return NextResponse.json({ error: 'Write what the banner says before turning it on.' }, { status: 400 });
    const { error } = await save([
      { key: 'banner_on', value: next.on ? 'on' : 'off' },
      { key: 'banner_text', value: next.text },
      { key: 'banner_until', value: next.until },
    ]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    const changed = before.banner.on !== next.on || before.banner.text !== next.text || before.banner.until !== next.until;
    if (changed)
      await logAudit(auth.svc, {
        actorId: auth.user.id,
        action: 'update',
        entityType: 'site setting',
        entityId: null,
        summary: next.on
          ? `Showed the portal banner “${next.text}”${next.until ? ` until ${next.until}` : ''}`
          : before.banner.on
            ? 'Turned the portal banner off'
            : 'Changed the portal banner text',
        details: { setting: 'banner', from: before.banner, to: next },
      });
    return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
  }

  return NextResponse.json({ error: 'Say which setting.' }, { status: 400 });
}
