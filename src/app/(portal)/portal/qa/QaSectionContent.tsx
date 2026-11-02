'use client';

import { useCallback, useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import HostQa from './HostQa';
import QaConsole from './QaConsole';
import QaList from './QaList';
import { parseQaRoute, qaParams, type QaRoute } from './qaRoute';
import polls from '../polls/polls.module.css';

// Q&A: a live question wall for an event, run from the portal by officers and above and asked into from phones with a 6-digit code or a QR code, no account needed. Every place has its own address (see qaRoute.ts).
export default function QaSectionContent() {
  const { tab, subtab } = useUrlNav();
  const setParams = usePortalParams();
  const [route, setRoute] = useState<QaRoute>(() => parseQaRoute(tab, subtab));
  const go = useCallback(
    (r: QaRoute) => {
      setRoute(r);
      setParams({ section: 'qa', ...qaParams(r) });
    },
    [setParams],
  );
  if (route.tab === 'host') return <HostQa key={route.slug} slug={route.slug} onExit={() => go({ tab: 'session', slug: route.slug })} />;
  return (
    <div className={polls.page}>
      {route.tab === 'list' && (
        <SectionHeader
          title="Q&A"
          flush
          sub="A live question wall. Guests send questions with the 6-digit code or the QR code on their phone, you approve them, and the room likes the best ones."
        />
      )}
      {route.tab === 'list' ? (
        <QaList onOpen={(slug) => go({ tab: 'session', slug })} />
      ) : (
        <QaConsole
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
