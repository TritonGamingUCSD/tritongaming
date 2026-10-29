import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { OPTION_KINDS, type OptionKind } from '@/lib/logistics/constants';
import { APPLIES, cleanItems, cleanValue } from '@/lib/logistics/optionsServer';

export const dynamic = 'force-dynamic';

// Add a value to a dropdown list. Adding one that already exists (any capitalisation) just returns it, so "add while picking" never fails on a duplicate.
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const kind = b.kind as OptionKind;
  const value = cleanValue(b.value);
  if (!OPTION_KINDS.includes(kind) || !value) return NextResponse.json({ error: 'Type a name to add.' }, { status: 400 });
  const { data: dup } = await auth.svc
    .from('logistics_options')
    .select('id, value, meta')
    .eq('kind', kind)
    .ilike(
      'value',
      value.replace(/[%_]/g, (c) => `\\${c}`),
    )
    .maybeSingle();
  if (dup)
    return NextResponse.json({
      option: { id: dup.id, value: dup.value, ...(kind === 'type' ? { counted: !!(dup.meta as { counted?: boolean } | null)?.counted } : {}) },
      existed: true,
    });
  const { data: last } = await auth.svc.from('logistics_options').select('sort').eq('kind', kind).order('sort', { ascending: false }).limit(1).maybeSingle();
  let meta: Record<string, unknown> = kind === 'type' ? { counted: b.counted === true } : {};
  if (kind === 'step') meta = { applies: APPLIES.includes(b.applies) ? b.applies : 'all', kit: b.kit === true };
  if (kind === 'bundle') {
    const r = await cleanItems(auth.svc, b.items);
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
    meta = { items: r.items };
  }
  if (kind === 'prize_step') meta = { gives: b.gives === true, leftover: b.leftover === true };
  const { data, error } = await auth.svc
    .from('logistics_options')
    .insert({ kind, value, sort: ((last?.sort as number | undefined) ?? 0) + 1, meta })
    .select('id, value, meta')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t add that.' }, { status: 500 });
  return NextResponse.json(
    {
      option: {
        id: data.id,
        value: data.value,
        ...(kind === 'type' ? { counted: !!(data.meta as { counted?: boolean }).counted } : {}),
        ...(kind === 'step' ? { applies: (meta as { applies: string }).applies, kit: (meta as { kit?: boolean }).kit === true } : {}),
        ...(kind === 'prize_step' ? { gives: (meta as { gives?: boolean }).gives === true, leftover: (meta as { leftover?: boolean }).leftover === true } : {}),
        ...(kind === 'bundle' ? { items: (meta as { items: unknown }).items } : {}),
      },
    },
    { status: 201 },
  );
}
