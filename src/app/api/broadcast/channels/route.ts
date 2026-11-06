import { NextResponse } from 'next/server';
import { broadcaster, loadChannels } from '@/lib/broadcast/server';
import { CHANNEL_KEYS, cleanTwitch, cleanYoutube } from '@/lib/broadcast/config';
import { createServiceClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The club's channel names are public (the watch page embeds them).
export async function GET() {
  return NextResponse.json(await loadChannels());
}

// { twitch?, youtube? }: a Twitch channel name or link, a YouTube channel id (UC…) or /channel/ link. Empty clears it.
export async function PUT(request: Request) {
  const a = await broadcaster();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { twitch?: string; youtube?: string };
  const svc = createServiceClient();
  const rows: { key: string; value: string }[] = [];
  if (typeof b.twitch === 'string') {
    const v = b.twitch.trim() ? cleanTwitch(b.twitch) : '';
    if (b.twitch.trim() && !v) return NextResponse.json({ error: 'That does not look like a Twitch channel name.' }, { status: 400 });
    rows.push({ key: CHANNEL_KEYS.twitch, value: v });
  }
  if (typeof b.youtube === 'string') {
    const v = b.youtube.trim() ? cleanYoutube(b.youtube) : '';
    if (b.youtube.trim() && !v)
      return NextResponse.json(
        {
          error:
            'YouTube needs the channel ID (starts with UC, from YouTube Studio → Settings → Channel → Advanced) or a youtube.com/channel/… link. A @handle will not work for embedding.',
        },
        { status: 400 },
      );
    rows.push({ key: CHANNEL_KEYS.youtube, value: v });
  }
  if (rows.length) await svc.from('team_settings').upsert(rows, { onConflict: 'key' });
  await logAudit(svc, { actorId: a.user.id, action: 'update', entityType: 'broadcast', entityId: 'channels', summary: 'Changed the broadcast channels' });
  return NextResponse.json({ ok: true, ...(await loadChannels(svc)) });
}
