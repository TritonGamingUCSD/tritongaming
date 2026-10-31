'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { audienceLabel } from '@/lib/meetings/meetingAudience';
import styles from './meetings.module.css';
import { Aud, audienceEmpty } from './audience';
import { AudiencePicker } from './AudiencePicker';

// Who it is for, as one line with a Change button: the full picker only opens when it is needed (always open while nobody is chosen yet).
export function AudienceField({ value, onChange }: { value: Aud; onChange: (v: Aud) => void }) {
  const [open, setOpen] = useState(false);
  const empty = audienceEmpty(value);
  const summary = empty ? 'Nobody chosen yet' : audienceLabel({ audience: value.roles, invitees: value.invitees, group_ids: value.groups });
  return (
    <div className={styles.audienceField}>
      <div className={styles.audienceHead}>
        <span className={styles.audienceTitle}>Who Is It For?</span>
        <span className={`${styles.audienceSummary} ${empty ? styles.audienceNone : ''}`}>{summary}</span>
        {!empty && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Done' : 'Change'}
          </Button>
        )}
      </div>
      {(empty || open) && <AudiencePicker value={value} onChange={onChange} />}
    </div>
  );
}
