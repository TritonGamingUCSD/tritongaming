import { NextResponse } from 'next/server';
import { AREAS, type Area } from '@/lib/wordfilter/filter';
import { reportBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

// A page that saves straight to the database was refused by it and tells us, so the admin can see it in the log. { area: 'profiles' | 'content', fields: { Name: 'text', ... } } → { message } (the line the admins want people to see). Only a text that really hits the lists is logged, and only the matched word is kept.
export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { area?: string; fields?: Record<string, unknown> };
  const area = (AREAS as readonly string[]).includes(b.area ?? '') ? (b.area as Area) : 'content';
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.fields ?? {}).slice(0, 8)) if (typeof v === 'string') fields[k.slice(0, 40)] = v.slice(0, 4000);
  const message = await reportBlocked(area, fields);
  return NextResponse.json({ message });
}
