'use client';

import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { useState } from 'react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import styles from './meetings.module.css';
import { TeamPerson } from './types';
import { PeoplePicker } from './PeoplePicker';

// ── Teams: saved groups of people ("Directors", "Marketing team"), managed from TG Members and used to invite people in one go ─────────────
// One team being made or changed. Edits stay local until Save changes (the bar at the bottom): Discard puts back what was saved, and the page will not let you leave until you pick one.
export function TeamEditor({
  initial,
  team,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: { id: string | null; name: string; ids: string[] };
  team: TeamPerson[] | null;
  busy: boolean;
  error: string;
  onSave: (v: { name: string; ids: string[] }) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [ids, setIds] = useState(initial.ids);
  const { dirty, markSaved, saved } = useUnsavedChanges({ name, ids });
  const [problem, setProblem] = useState('');
  return (
    <div className={styles.form}>
      <EditingNow room={initial.id ? `team:${initial.id}` : null} what="this team" />
      <Field label="Team name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Directors, Marketing team" maxLength={60} autoFocus />
      </Field>
      <PeoplePicker team={team} value={ids} onChange={setIds} />
      {(problem || error) && <Notice tone="error">{problem || error}</Notice>}
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {dirty ? 'Close without saving' : 'Close'}
        </Button>
      </div>
      <SaveBar
        dirty={dirty}
        saving={busy}
        saveLabel={initial.id ? 'Save changes' : 'Create team'}
        onSave={async () => {
          if (!name.trim() || ids.length === 0) {
            setProblem('Give the team a name and pick at least one person.');
            return;
          }
          setProblem('');
          if (await onSave({ name, ids })) markSaved();
        }}
        onDiscard={() => {
          const v = saved();
          setName(v.name);
          setIds(v.ids);
        }}
      />
    </div>
  );
}
