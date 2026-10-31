'use client';

import Loading from '@/components/Loading/Loading';
import { useState } from 'react';
import { ChevronRight, UserPlus, Plus, Moon } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import SectionTabs from '@/components/ui/SectionTabs';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { confirmHold } from '@/lib/ui/confirmHold';
import { usePortalTabSync, useUrlNav } from '@/lib/portal/usePortalTabSync';
import styles from './meetings.module.css';
import { Avatar } from './Avatar';
import { Group } from './types';
import { useGroups, useTeam } from './hooks';
import { TeamEditor } from './TeamEditor';

export function TeamsPanel({ userId, canManageAll, canEdit = true }: { userId: string; canManageAll: boolean; canEdit?: boolean }) {
  const team = useTeam();
  const [groups, reload] = useGroups();
  const { subtab } = useUrlNav();
  const syncTab = usePortalTabSync('members');
  // Local state drives the view (the address is a path, which changes without re-rendering this); the address is kept in step so the view can be linked to.
  const [view, setView] = useState<'teams' | 'people'>(subtab === 'people' ? 'people' : 'teams');
  const [editing, setEditing] = useState<{ id: string | null; name: string; ids: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null); // the team whose "add a person" box is open
  const [pickQuery, setPickQuery] = useState(''); // the search inside that box (separate from the page's search, so the list isn't narrowed by something typed above)
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // teams opened to show who is on them (closed by default)
  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [onlyNone, setOnlyNone] = useState(false);
  const mayChange = (g: Group) => canEdit && (canManageAll || g.created_by === userId);

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setError('');
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Something went wrong.');
        return false;
      }
      await reload();
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    }
  }
  async function save(v: { name: string; ids: string[] }) {
    if (!editing) return false;
    setBusy(true);
    try {
      const ok = await send(editing.id ? `/api/meetings/groups/${editing.id}` : '/api/meetings/groups', editing.id ? 'PATCH' : 'POST', { name: v.name, member_ids: v.ids });
      if (ok) setEditing(null);
      return ok;
    } finally {
      setBusy(false);
    }
  }
  async function remove(g: Group) {
    if (!(await confirmHold({ title: `Delete “${g.name}”?`, message: 'Meetings already scheduled for this team keep their invited people.', confirmLabel: 'Hold to delete' })))
      return;
    await send(`/api/meetings/groups/${g.id}`, 'DELETE');
  }
  // One person on or off a team without opening the editor.
  async function setMember(g: Group, personId: string, on: boolean) {
    const ids = on ? [...new Set([...g.member_ids, personId])] : g.member_ids.filter((x) => x !== personId);
    if (ids.length === 0) {
      setError('A team needs at least one person. Delete the team instead.');
      return;
    }
    await send(`/api/meetings/groups/${g.id}`, 'PATCH', { member_ids: ids });
  }

  const people = (team ?? []).filter((p) => !p.alumni);
  const byId = new Map((team ?? []).map((p) => [p.id, p]));
  const teamsOf = (id: string) => (groups ?? []).filter((g) => g.member_ids.includes(id));
  const q = query.trim().toLowerCase();
  const shownTeams = (groups ?? []).filter((g) => !q || g.name.toLowerCase().includes(q) || g.member_ids.some((id) => (byId.get(id)?.name ?? '').toLowerCase().includes(q)));
  const withoutTeam = people.filter((p) => teamsOf(p.id).length === 0);
  const shownPeople = people.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!onlyNone || teamsOf(p.id).length === 0));
  const switchView = (v: 'teams' | 'people') => {
    setView(v);
    syncTab('team', v === 'people' ? 'people' : null);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <p className={styles.muted}>
          {canEdit ? 'Put people on teams here; a team can also be invited to a meeting in one go.' : 'The teams leads and exec use. You can look but not change them.'}
        </p>
        {canEdit && !editing && (
          <Button size="sm" onClick={() => setEditing({ id: null, name: '', ids: [] })}>
            <Plus size={14} aria-hidden="true" /> New team
          </Button>
        )}
      </div>

      {editing && (
        <TeamEditor
          key={editing.id ?? 'new'}
          initial={editing}
          team={team}
          busy={busy}
          error={error}
          onSave={save}
          onClose={() => {
            setEditing(null);
            setError('');
          }}
        />
      )}
      {error && !editing && <Notice tone="error">{error}</Notice>}

      {!editing && groups && groups.length > 0 && (
        <div className={styles.teamTools}>
          <SectionTabs
            value={view}
            onChange={switchView}
            tabs={[
              { id: 'teams', label: 'By team' },
              { id: 'people', label: 'By person' },
            ]}
          />
          <Input
            className={styles.teamSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === 'teams' ? 'Search teams or people…' : 'Search people…'}
            aria-label="Search"
          />
        </div>
      )}

      {!groups ? (
        <Loading label="Loading teams…" />
      ) : groups.length === 0 && !editing ? (
        <div className={styles.card}>
          <p className={styles.muted}>No teams yet.</p>
        </div>
      ) : editing ? null : view === 'teams' ? (
        <ul className={styles.meetingList}>
          {shownTeams.length === 0 && <li className={styles.faint}>No team or person matches that.</li>}
          {shownTeams.map((g) => {
            const may = mayChange(g);
            // Closed unless opened, or unless a search is on (someone searching for a person wants to see where they are).
            const isOpen = expanded.has(g.id) || q !== '';
            const free = people.filter((p) => !g.member_ids.includes(p.id));
            const pickQ = adding === g.id ? pickQuery.trim().toLowerCase() : '';
            return (
              <li key={g.id} className={`${styles.meetingCard} ${styles.teamCard}`}>
                <div className={styles.teamHead}>
                  <button type="button" className={styles.teamToggle} aria-expanded={isOpen} aria-controls={`team-${g.id}`} onClick={() => toggleOpen(g.id)}>
                    <ChevronRight size={16} strokeWidth={2} aria-hidden="true" className={`${styles.teamChevron} ${isOpen ? styles.teamChevronOpen : ''}`} />
                    <strong>{g.name}</strong>
                    <span className={styles.muted}>
                      · {g.member_ids.length} {g.member_ids.length === 1 ? 'person' : 'people'}
                    </span>
                    <span className={styles.teamShow}>{isOpen ? 'Hide' : 'Show who'}</span>
                  </button>
                  {may ? (
                    <span className={styles.teamActions}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const open = adding !== g.id;
                          setAdding(open ? g.id : null);
                          setPickQuery('');
                          if (open) setExpanded((prev) => new Set(prev).add(g.id));
                        }}
                        aria-expanded={adding === g.id}
                      >
                        <UserPlus size={14} aria-hidden="true" /> Add person
                      </Button>
                      <IconButton
                        kind="edit"
                        label={`Rename or edit ${g.name}`}
                        onClick={() => {
                          setEditing({ id: g.id, name: g.name, ids: [...g.member_ids] });
                          setError('');
                        }}
                      />
                      <IconButton kind="delete" label={`Delete ${g.name}`} onClick={() => remove(g)} />
                    </span>
                  ) : canEdit ? (
                    <span className={styles.faint}>made by someone else</span>
                  ) : null}
                </div>
                {isOpen && (
                  <ul className={styles.memberChips} id={`team-${g.id}`}>
                    {g.member_ids.map((id) => {
                      const p = byId.get(id);
                      return (
                        <li key={id} className={styles.memberChip}>
                          {p ? <Avatar p={p} /> : null}
                          <span>{p?.name ?? 'Someone'}</span>
                          {p?.inactive && (
                            <span className={styles.idleTag} title="Inactive this quarter: stays on the team, but meetings that pick this team do not expect them">
                              <Moon size={11} aria-hidden="true" /> {p.alumni ? 'Alumni' : 'Inactive now'}
                            </span>
                          )}
                          {may && (
                            <button type="button" className={styles.chipX} aria-label={`Take ${p?.name ?? 'them'} off ${g.name}`} onClick={() => setMember(g, id, false)}>
                              ×
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {adding === g.id && (
                  <div className={styles.quickAdd}>
                    <Input
                      style={{ maxWidth: '22rem' }}
                      value={pickQuery}
                      onChange={(e) => setPickQuery(e.target.value)}
                      placeholder="Search people to add…"
                      aria-label={`Search people to add to ${g.name}`}
                    />
                    <span className={styles.faint}>
                      Tap a person to add them · {free.filter((p) => !pickQ || p.name.toLowerCase().includes(pickQ)).length} of {free.length} not on this team yet:
                    </span>
                    <ul className={styles.quickList}>
                      {free
                        .filter((p) => !pickQ || p.name.toLowerCase().includes(pickQ))
                        .map((p) => (
                          <li key={p.id}>
                            <button type="button" className={styles.quickPick} onClick={() => setMember(g, p.id, true)}>
                              <Avatar p={p} />
                              <span>{p.name}</span>
                              <Plus size={13} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      {free.length === 0 && <li className={styles.faint}>Everyone is already on this team.</li>}
                      {free.length > 0 && pickQ && free.every((p) => !p.name.toLowerCase().includes(pickQ)) && <li className={styles.faint}>No one matches that.</li>}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <label className={styles.onlyNone}>
            <input type="checkbox" checked={onlyNone} onChange={(e) => setOnlyNone(e.target.checked)} /> Only people on no team yet <strong>({withoutTeam.length})</strong>
          </label>
          <ul className={styles.meetingList}>
            {shownPeople.length === 0 && <li className={styles.faint}>{onlyNone && !q ? 'Everyone is on at least one team.' : 'No one matches that.'}</li>}
            {shownPeople.map((p) => {
              const mine = teamsOf(p.id);
              const addable = (groups ?? []).filter((g) => mayChange(g) && !g.member_ids.includes(p.id));
              return (
                <li key={p.id} className={`${styles.meetingCard} ${styles.teamPersonRow}`}>
                  <Avatar p={p} />
                  <span className={styles.personWho}>
                    <strong>{p.name}</strong>
                    <span className={styles.faint}>
                      {p.role}
                      {p.inactive ? ' · inactive' : ''}
                    </span>
                  </span>
                  <ul className={styles.memberChips}>
                    {mine.length === 0 && <li className={styles.noTeam}>No team yet</li>}
                    {mine.map((g) => (
                      <li key={g.id} className={styles.memberChip}>
                        <span>{g.name}</span>
                        {mayChange(g) && (
                          <button type="button" className={styles.chipX} aria-label={`Take ${p.name} off ${g.name}`} onClick={() => setMember(g, p.id, false)}>
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {addable.length > 0 && (
                    <Select
                      value=""
                      onChange={(e) => {
                        const g = addable.find((x) => x.id === e.target.value);
                        if (g) setMember(g, p.id, true);
                      }}
                      aria-label={`Add ${p.name} to a team`}
                    >
                      <option value="">+ Add to a team</option>
                      {addable.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
