'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { Field, Input } from '@/components/ui/Field';
import { showToast } from '@/lib/ui/toast';
import { call } from './types';
import styles from './broadcast.module.css';

// The club's channel on each platform, used by the public Watch page to embed the live stream and chat. A Twitch name or link; for YouTube the channel ID (the @handle cannot be embedded).
export default function SetupTab({ divisionId, divisionName, divisionSlug }: { divisionId?: string; divisionName?: string; divisionSlug?: string }) {
  const [twitch, setTwitch] = useState('');
  const [youtube, setYoutube] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void (async () => {
      const r = await call<{ twitch: string; youtube: string }>('GET', divisionId ? `/api/broadcast/channels?division=${divisionId}` : '/api/broadcast/channels');
      if (r.ok) {
        setTwitch(r.j.twitch);
        setYoutube(r.j.youtube);
      }
    })();
  }, [divisionId]);
  const watch = divisionSlug ? `/watch/${divisionSlug}` : '/watch';
  return (
    <div className={styles.setup}>
      <section className={styles.card}>
        <h3>{divisionName ? `${divisionName} channels` : 'Club channels'}</h3>
        <p className={styles.muted}>
          Viewers watch on the website at {watch}, with the live stream and chat embedded. Nothing is connected to your accounts; only the public channel names are used.
        </p>
        <p className={styles.muted}>
          {divisionName
            ? `These belong to ${divisionName} only. Triton Gaming and every other division have their own channels, set on their own Broadcast pages.`
            : 'These are the club’s channels only. Each division sets its own on its Broadcast page, and they never show here.'}
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Twitch channel" hint="A name like tritongaming, or the twitch.tv link.">
          <Input value={twitch} onChange={(e) => setTwitch(e.target.value)} placeholder="tritongaming" />
        </Field>
        <Field label="YouTube channel ID" hint="Starts with UC. In YouTube Studio: Settings → Channel → Advanced settings. Or paste a youtube.com/channel/… link.">
          <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" />
        </Field>
        <div className={styles.actions}>
          <Button
            onClick={async () => {
              setError('');
              const r = await call<{ twitch: string; youtube: string }>('PUT', '/api/broadcast/channels', { twitch, youtube, division_id: divisionId });
              if (r.ok) {
                setTwitch(r.j.twitch);
                setYoutube(r.j.youtube);
                setSaved(true);
                showToast('Channels saved');
              } else setError(r.j.error || 'Could not save.');
            }}
          >
            Save
          </Button>
          <a className={styles.tLink} href={watch} target="_blank" rel="noopener noreferrer">
            Open the Watch page
          </a>
        </div>
        {saved && <p className={styles.muted}>Saved. The Watch page shows the stream when you mark a broadcast Live on the Schedule tab.</p>}
      </section>
    </div>
  );
}
