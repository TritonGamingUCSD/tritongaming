import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadChannels } from '@/lib/broadcast/server';
import { PageHero } from '@/components/ZineBand/ZineBand';
import styles from './watch.module.css';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });

// The live stream and chat embedded on the site, with the schedule underneath, for the club or for one division (each has its own channels and schedule). A broadcast marked Live on the portal's Broadcast page switches the player on.
export default async function WatchView({ division }: { division?: { id: string; name: string } }) {
  const svc = createServiceClient();
  // the club's broadcasts have no division; a division sees only its own
  const mine = <T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(q: T) => (division ? q.eq('division_id', division.id) : q.is('division_id', null));
  const [channels, liveRes, nextRes] = await Promise.all([
    loadChannels(svc, division?.id ?? null),
    mine(svc.from('broadcasts').select('id, title, platform, tournament_id').eq('status', 'live').order('starts_at', { ascending: false }).limit(1)),
    mine(
      svc
        .from('broadcasts')
        .select('id, title, starts_at, platform')
        .eq('status', 'scheduled')
        .gte('starts_at', new Date(Date.now() - 3 * 3600e3).toISOString())
        .order('starts_at')
        .limit(6),
    ),
  ]);
  const live = liveRes.data?.[0];
  const next = nextRes.data ?? [];
  const host = (await headers()).get('host')?.split(':')[0] ?? 'localhost';
  const twitch = channels.twitch;
  const youtube = channels.youtube;
  const showTwitch = !!twitch && (!live || live.platform !== 'youtube');
  const showYoutube = !!youtube && !showTwitch;
  let slug: string | null = null;
  if (live?.tournament_id) {
    const { data } = await svc.from('tournaments').select('slug, is_public, status').eq('id', live.tournament_id).maybeSingle();
    if (data?.is_public && data.status !== 'draft') slug = data.slug as string;
  }
  return (
    <main>
      <PageHero label={division ? division.name : 'Live'} title="Watch" sub={live ? `Now streaming: ${live.title}` : 'Our streams, with chat. We are not live right now.'} />
      <section className={styles.wrap}>
        {live && (showTwitch || showYoutube) ? (
          <div className={styles.player}>
            <div className={styles.video}>
              {showTwitch ? (
                <iframe
                  title="Twitch stream"
                  src={`https://player.twitch.tv/?channel=${encodeURIComponent(twitch)}&parent=${encodeURIComponent(host)}&muted=false`}
                  allowFullScreen
                />
              ) : (
                <iframe
                  title="YouTube stream"
                  src={`https://www.youtube.com/embed/live_stream?channel=${encodeURIComponent(youtube)}`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            {showTwitch && (
              <iframe
                className={styles.chat}
                title="Twitch chat"
                src={`https://www.twitch.tv/embed/${encodeURIComponent(twitch)}/chat?parent=${encodeURIComponent(host)}&darkpopout`}
              />
            )}
          </div>
        ) : (
          <div className={styles.offline}>
            <b>We are not live right now.</b>
            <span>{next.length ? 'Here is what is coming up.' : 'Check back soon, or find us on Twitch and YouTube.'}</span>
            <div className={styles.links}>
              {twitch && (
                <a href={`https://twitch.tv/${twitch}`} target="_blank" rel="noopener noreferrer">
                  Twitch
                </a>
              )}
              {youtube && (
                <a href={`https://youtube.com/channel/${youtube}`} target="_blank" rel="noopener noreferrer">
                  YouTube
                </a>
              )}
            </div>
          </div>
        )}
        {slug && (
          <a className={styles.bracketLink} href={`/tournaments/${slug}`}>
            See the live bracket →
          </a>
        )}
        {next.length > 0 && (
          <section className={styles.sched} aria-label="Schedule">
            <h2>Coming up</h2>
            <ul>
              {next.map((b) => (
                <li key={b.id as string}>
                  <b>{b.title as string}</b>
                  <span>{when(b.starts_at as string)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
