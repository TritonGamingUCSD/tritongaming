import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { MAX_PREVIEW_PEOPLE } from '@/lib/portal/siteSettings';
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
//   POST { setting: 'divisions_open', on: boolean }       show the division features to everyone (off: admins only)
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

  if (b.setting === 'divisions_open') {
    const on = b.on === true;
    const { error } = await save([{ key: 'divisions_open', value: on ? 'on' : 'off' }]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    if (on !== before.divisionsOpen)
      await logAudit(auth.svc, {
        actorId: auth.user.id,
        action: 'update',
        entityType: 'site setting',
        entityId: null,
        summary: on ? 'Turned the division features on for everyone' : 'Made the division features admin-only',
        details: { setting: 'divisions_open', from: before.divisionsOpen, to: on },
      });
    return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
  }

  // { setting: 'divisions_preview', add_email? , remove_id? }: who else may see the division features while they are admin-only.
  if (b.setting === 'divisions_preview') {
    let list = [...before.divisionsPreview];
    let summary = '';
    if (typeof b.add_email === 'string' && b.add_email.trim()) {
      const { data: found } = await auth.svc.rpc('find_users_by_emails', { _emails: [b.add_email.trim().toLowerCase()] });
      const ids = [...new Set(((found ?? []) as { user_id: string }[]).map((r) => r.user_id))];
      if (ids.length === 0) return NextResponse.json({ error: 'No one has signed in with that address yet.' }, { status: 404 });
      if (ids.length > 1) return NextResponse.json({ error: 'That address belongs to more than one account.' }, { status: 409 });
      if (list.some((p) => p.id === ids[0])) return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
      if (list.length >= MAX_PREVIEW_PEOPLE) return NextResponse.json({ error: `Up to ${MAX_PREVIEW_PEOPLE} people can preview.` }, { status: 400 });
      const { data: prof } = await auth.svc.from('profiles').select('display_name').eq('id', ids[0]).maybeSingle();
      list = [...list, { id: ids[0], name: (prof?.display_name as string | null) || 'Someone' }];
      summary = `Let ${(prof?.display_name as string | null) || 'someone'} preview the division features`;
    } else if (typeof b.remove_id === 'string') {
      const gone = list.find((p) => p.id === b.remove_id);
      list = list.filter((p) => p.id !== b.remove_id);
      summary = `Stopped ${gone?.name ?? 'someone'} previewing the division features`;
    } else return NextResponse.json({ error: 'Say who.' }, { status: 400 });
    const { error } = await save([{ key: 'divisions_preview', value: JSON.stringify(list) }]);
    if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'site setting', entityId: null, summary, details: { setting: 'divisions_preview' } });
    return NextResponse.json({ settings: await loadSiteSettings(auth.svc) });
  }

  return NextResponse.json({ error: 'Say which setting.' }, { status: 400 });
}
