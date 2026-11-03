'use client';

import { useEffect, useState } from 'react';
import { call, type Block, type IssueType } from './api';
import styles from './newspaper.module.css';

export interface Draft {
  title: string;
  preheader: string;
  type: IssueType;
  event_id: string | null;
  blocks: Block[];
}

// The email as it will look, drawn by the same code that sends it. It asks the server (which knows the events) a moment after the last change, and shows the answer in a frame that can run nothing.
export default function IssuePreview({ slug, draft }: { slug: string; draft: Draft }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const key = JSON.stringify(draft);
  useEffect(() => {
    let on = true;
    const t = window.setTimeout(async () => {
      const r = await call<{ html: string }>(`/api/newspaper/${slug}/preview`, 'POST', JSON.parse(key));
      if (!on) return;
      if (r.ok) {
        setHtml(r.data.html);
        setError('');
      } else setError(r.error);
    }, 500);
    return () => {
      on = false;
      window.clearTimeout(t);
    };
  }, [slug, key]);
  return (
    <div className={styles.frameWrap}>
      {error && <p className={styles.frameNote}>{error}</p>}
      <iframe className={styles.frame} title="Preview of the email" sandbox="" srcDoc={html} />
      <p className={styles.frameNote}>This is how the email looks. Email apps differ a little; send yourself a test to see it in yours.</p>
    </div>
  );
}
