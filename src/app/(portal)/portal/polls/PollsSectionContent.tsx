'use client';

import { useCallback, useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import HostPoll from './HostPoll';
import PollEditor from './PollEditor';
import PollsList from './PollsList';
import { parsePollsRoute, pollsParams, type PollsRoute } from './pollsRoute';
import styles from './polls.module.css';

// Polls: a vote for an event (a cosplay contest, a favourite, a choice on stage) run from the portal by officers and above and voted on from phones with a 6-digit code or a QR code, no account needed.
// Every place has its own address (see pollsRoute.ts).
export default function PollsSectionContent() {
  const { tab, subtab } = useUrlNav();
  const setParams = usePortalParams();
  const [route, setRoute] = useState<PollsRoute>(() => parsePollsRoute(tab, subtab));
  const go = useCallback(
    (r: PollsRoute) => {
      setRoute(r);
      setParams({ section: 'polls', ...pollsParams(r) });
    },
    [setParams],
  );
  if (route.tab === 'host') return <HostPoll key={route.slug} slug={route.slug} onExit={() => go({ tab: 'poll', slug: route.slug })} />;
  return (
    <div className={styles.page}>
      {route.tab === 'list' && (
        <SectionHeader title="Polls" flush sub="Run a vote on a big screen. Guests join with the 6-digit code or the QR code on their phone, no account needed." />
      )}
      {route.tab === 'list' ? (
        <PollsList onOpen={(slug) => go({ tab: 'poll', slug })} onRun={(slug) => go({ tab: 'host', slug })} />
      ) : (
        <PollEditor
          key={route.slug}
          slug={route.slug}
          onBack={() => go({ tab: 'list' })}
          onRun={() => go({ tab: 'host', slug: route.slug })}
          onDeleted={() => go({ tab: 'list' })}
        />
      )}
    </div>
  );
}
