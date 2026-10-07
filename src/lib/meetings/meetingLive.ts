import { createServiceClient } from '@/lib/supabase/admin';

/** Tells the projector screen and anyone watching a poll that something changed in this meeting (a check-in, an answer, a reaction, an excuse), so
 *  they refresh right away instead of asking every few seconds. Failing to send is harmless: the screens also refresh slowly on their own. */
export async function notifyMeetingLive(meetingId: string) {
  const send = async () => {
    const svc = createServiceClient();
    const channel = svc.channel(`meeting-live:${meetingId}`);
    const sent = await channel.httpSend('changed', {});
    if (!sent.success) console.warn('meeting broadcast was not accepted', sent);
    await svc.removeChannel(channel);
  };
  // Never holds up (or fails) the action itself: give up after a moment.
  try { await Promise.race([send(), new Promise((resolve) => setTimeout(resolve, 1500))]); } catch (e) { console.warn('meeting broadcast failed', e); }
}
