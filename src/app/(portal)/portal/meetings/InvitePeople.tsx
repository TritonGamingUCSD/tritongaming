'use client';

import { useState } from 'react';
import { UserPlus, Users, Lock, DoorOpen } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { AUDIENCE_ROLES, audienceLabel, audienceRoles } from '@/lib/meetings/meetingAudience';
import styles from './meetings.module.css';
import { Live } from './types';
import { useTeam } from './hooks';
import { PeoplePicker } from './PeoplePicker';

// Add more people to a meeting that already exists. Roles and groups stay as they are (and keep pulling
// people in live); this only adds individuals on top. People already covered show ticked and locked.
export function InvitePeople({ live, meetingId, onSaved }: { live: Live; meetingId: string; onSaved: () => void }) {
  const team = useTeam();
  const [ids, setIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const m = live.meeting;
  const invited = m.invitees ?? [];
  const teamOpen = m.open_to_team !== false;
  // A meeting for every team role needs no switch: everyone is already expected.
  const wholeTeam =
    audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }).length === AUDIENCE_ROLES.length && !m.invitees?.length && !m.group_ids?.length;
  async function setOpenToTeam(open: boolean) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/meetings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: meetingId,
          invitees: m.invitees ?? [],
          group_ids: m.group_ids ?? [],
          audience: audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }),
          open_to_team: open,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to save.');
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  // Expected people who are in only because of a role or group (not individually added).
  const covered = new Map<string, string>();
  for (const p of [...live.attendees, ...live.missing, ...live.absent]) if (!invited.includes(p.id)) covered.set(p.id, 'role or group');

  async function save() {
    if (!ids) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/meetings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: meetingId,
          invitees: ids,
          group_ids: m.group_ids ?? [],
          audience: audienceRoles({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids }),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to save.');
        return;
      }
      setIds(null);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (!ids) {
    return (
      <div className={styles.inviteWrap}>
        <div className={styles.inviteBar}>
          <span className={styles.faint}>
            <Users size={12} aria-hidden="true" /> For: {audienceLabel({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids, groupNames: m.groupNames })}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setIds([...invited])}>
            <UserPlus size={14} aria-hidden="true" /> Add people
          </Button>
        </div>
        {/* Who can check in, said plainly: the whole team, or only the people it is for. */}
        <div className={`${styles.accessBox} ${wholeTeam ? styles.accessOpen : teamOpen ? styles.accessOpen : styles.accessLimited}`} role="status">
          <span className={styles.accessIcon} aria-hidden="true">
            {wholeTeam || teamOpen ? <DoorOpen size={18} /> : <Lock size={18} />}
          </span>
          <span className={styles.accessText}>
            <strong>{wholeTeam ? 'Open To The Whole Team' : teamOpen ? 'Any Officer Or Recruit Can Join' : 'Only The People It Is For Can Join'}</strong>
            <span>
              {wholeTeam
                ? 'Everyone on the team is expected, so nobody is turned away.'
                : teamOpen
                  ? 'People who were not added check in too and show as +1.'
                  : 'Anyone else who scans the code is turned away.'}
            </span>
          </span>
          {!wholeTeam && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => setOpenToTeam(!teamOpen)}>
              {teamOpen ? 'Limit To The List' : 'Let The Team Join'}
            </Button>
          )}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }
  return (
    <div className={styles.card}>
      <h3 className={styles.listTitle}>
        Add people <span>{ids.length} added individually</span>
      </h3>
      <p className={styles.faint}>Tick anyone to invite them directly.</p>
      <PeoplePicker team={team} value={ids} onChange={setIds} covered={covered} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}>
        <Button
          variant="ghost"
          onClick={() => {
            setIds(null);
            setError('');
          }}
        >
          Cancel
        </Button>
        <Button onClick={save} loading={busy}>
          Save
        </Button>
      </div>
    </div>
  );
}
