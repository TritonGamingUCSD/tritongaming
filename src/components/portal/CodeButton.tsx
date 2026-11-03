'use client';

import { useRef, useState } from 'react';
import { Hash } from 'lucide-react';
import CodeEntry from '@/components/portal/CodeEntry';
import { useCodeFlow } from '@/components/portal/CodeBox';
import Popover from '@/components/ui/Popover';
import styles from './PortalThemeToggle.module.css';

// The Enter A Code button for the top bar, shown while the sidebar is hidden (the sidebar has the box itself): it opens a small panel with the same code box. The panel closes as soon as the code is sent, and the answer comes in the usual pop-up.
export default function CodeButton() {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const { submit, busy, dialog } = useCodeFlow();
  return (
    <>
      <button ref={anchor} type="button" className={styles.btn} aria-label="Enter a code" aria-expanded={open} title="Enter a code" onClick={() => setOpen((o) => !o)}>
        <Hash size={20} aria-hidden="true" />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={() => setOpen(false)} width={260} label="Enter a code">
          <div className="pp-root" style={{ display: 'grid', gap: '0.4rem', padding: '0.7rem' }}>
            <CodeEntry
              compact
              icon={<Hash />}

              autoFocus
              busy={busy}
              onSubmit={(c) => {
                setOpen(false);
                void submit(c);
              }}
            />
          </div>
        </Popover>
      )}
      {dialog}
    </>
  );
}
