'use client';

import { useCallback, useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import IssueEditor from './IssueEditor';
import NewspaperList from './NewspaperList';
import { newspaperParams, parseNewspaperRoute, type NewspaperRoute } from './newspaperRoute';
import polls from '../polls/polls.module.css';

// The Newspaper: the club's email, written as an issue of blocks, checked by a second person and sent to an audience picked by rules. Every place has its own address (see newspaperRoute.ts).
export default function NewspaperSectionContent() {
  const { tab, subtab } = useUrlNav();
  const setParams = usePortalParams();
  const [route, setRoute] = useState<NewspaperRoute>(() => parseNewspaperRoute(tab, subtab));
  const go = useCallback(
    (r: NewspaperRoute) => {
      setRoute(r);
      setParams({ section: 'newspaper', ...newspaperParams(r) });
    },
    [setParams],
  );
  return (
    <div className={polls.page}>
      {route.tab === 'list' && (
        <SectionHeader
          title="Newspaper"
          flush
          sub="Write the club’s email, have someone check it, and send it to the people you pick. Event announcements and updates are written here too."
        />
      )}
      {route.tab === 'list' ? (
        <NewspaperList onOpen={(slug) => go({ tab: 'issue', slug, view: 'write' })} />
      ) : (
        <IssueEditor key={route.slug} slug={route.slug} view={route.view} onView={(view) => go({ tab: 'issue', slug: route.slug, view })} onBack={() => go({ tab: 'list' })} />
      )}
    </div>
  );
}
