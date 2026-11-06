import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { FEATURE_SWITCHES, isSwitchKey, switchKey, featureOn } from '@/lib/portal/featureSwitches';
import { invalidate } from '@/lib/site/revalidate';
import { logAudit } from '@/lib/notifications/audit';
import { strictUser } from '@/lib/supabase/localAuth';
import {
  BANNER_MAX,
  CODE_STYLE_NAMES,
  CODE_USES,
  CODE_USE_NAMES,
  DEFAULT_SETTINGS,
  codeStyleKey,
  loadSiteSettings,
  styleFor,
  type CodeStyle,
  type CodeUse,
} from '@/lib/portal/siteSettings';

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
//   POST { setting: 'code_style', value: 'tg' | 'byte' | 'qr' }                          the default for every use
//   POST { setting: 'code_style', use: 'ticket' | 'meeting' | 'reward', value: 'tg' | 'byte' | 'qr' | 'default' }   one use's own (or back to following the default)
//   POST { setting: 'banner', on: boolean, text: string, until: 'YYYY-MM-DD' | '' }
//   POST { setting: 'switch', key, on: boolean }            one feature switch on or off
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

  if (b.setting === 'code_style' && CODE_USES.includes(b.use)) {
    const use: CodeUse = b.use;
    const next: CodeStyle | 'default' | null = b.reset || b.value === 'default' ? 'default' : b.value === 'tg' || b.value === 'byte' || b.value === 'qr' ? b.value : null;
    if (!next) return NextResponse.json({ error: 'Choose TGcode, Bytecode, QR code or the default.' }, { status: 400 });
    const { error } = next === 'default' ? await auth.svc.from('team_settings').delete().eq('key', codeStyleKey(use)) : await save([{ key: codeStyleKey(use), value: next }]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    const after = await loadSiteSettings(auth.svc);
    if (styleFor(before, use) !== styleFor(after, use) || (before.codeStyles[use] ?? 'default') !== (after.codeStyles[use] ?? 'default'))
      await logAudit(auth.svc, {
        actorId: auth.user.id,
        action: 'update',
        entityType: 'site setting',
        entityId: null,
        summary: `Changed the ${CODE_USE_NAMES[use].toLowerCase()} code from ${CODE_STYLE_NAMES[styleFor(before, use)]} to ${next === 'default' ? `${CODE_STYLE_NAMES[after.codeStyle]} (the default)` : CODE_STYLE_NAMES[next]}`,
        details: { setting: codeStyleKey(use), from: before.codeStyles[use] ?? 'default', to: next },
      });
    return NextResponse.json({ settings: after });
  }

  if (b.setting === 'code_style') {
    const value: CodeStyle | null = b.reset ? DEFAULT_SETTINGS.codeStyle : b.value === 'tg' || b.value === 'byte' || b.value === 'qr' ? b.value : null;
    if (!value) return NextResponse.json({ error: 'Choose TGcode, Bytecode or QR code.' }, { status: 400 });
    const { error } = await save([{ key: 'code_style', value }]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    if (value !== before.codeStyle)
      await logAudit(auth.svc, {
        actorId: auth.user.id,
        action: 'update',
        entityType: 'site setting',
        entityId: null,
        summary: `Changed the default code from ${CODE_STYLE_NAMES[before.codeStyle]} to ${CODE_STYLE_NAMES[value]}`,
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

  // { setting: 'switch', key, on }: one feature switch (see lib/portal/featureSwitches.ts).
  if (b.setting === 'switch') {
    if (!isSwitchKey(b.key)) return NextResponse.json({ error: 'Unknown switch.' }, { status: 400 });
    const on = b.on === true;
    const { error } = await save([{ key: switchKey(b.key), value: on ? 'on' : 'off' }]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    invalidate('switches', 'divisions', 'site-content');
    if (on !== featureOn(before, b.key)) {
      const sw = FEATURE_SWITCHES.find((x) => x.key === b.key)!;
      await logAudit(auth.svc, {
        actorId: auth.user.id,
        action: 'update',
        entityType: 'site setting',
        entityId: null,
        summary: `Turned ${sw.label} ${on ? 'on' : 'off'}`,
        details: { setting: switchKey(b.key), from: featureOn(before, b.key), to: on },
      });
    }
    return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
  }

  return NextResponse.json({ error: 'Say which setting.' }, { status: 400 });
}
