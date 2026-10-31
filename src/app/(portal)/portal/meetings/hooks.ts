'use client';

import { useCallback, useEffect, useState } from 'react';
import { Group, TeamPerson } from './types';

// A clock that ticks every 30 seconds, so time-dependent labels stay right without a refresh.
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export let teamCache: TeamPerson[] | null = null;

export let groupsCache: Group[] | null = null;

export function useTeam() {
  const [team, setTeam] = useState<TeamPerson[] | null>(teamCache);
  useEffect(() => {
    if (team) return;
    (async () => {
      try {
        const res = await fetch('/api/meetings/people', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) {
          teamCache = json.people;
          setTeam(json.people);
        }
      } catch {
        /* the list just stays empty */
      }
    })();
  }, [team]);
  return team;
}

export function useGroups(): [Group[] | null, () => Promise<void>] {
  const [groups, setGroups] = useState<Group[] | null>(groupsCache);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/groups', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        groupsCache = json.groups;
        setGroups(json.groups);
      }
    } catch {
      /* keep what we have */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return [groups, load];
}
