'use client';

import { useCallback, useState } from 'react';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import IssueEditor from './IssueEditor';
import NewsletterList from './NewsletterList';
import SubscribersPanel from './SubscribersPanel';
import { newsletterParams, parseNewsletterRoute, type NewsletterRoute } from './newsletterRoute';
import polls from '../polls/polls.module.css';

// The Newsletter: the club's email, written as an issue of blocks, checked by a second person and sent to an audience picked by rules. Every place has its own address (see newsletterRoute.ts).
export default function NewsletterSectionContent() {
  const { tab, subtab } = useUrlNav();
  const setParams = usePortalParams();
  const [route, setRoute] = useState<NewsletterRoute>(() => parseNewsletterRoute(tab, subtab));
  const go = useCallback(
    (r: NewsletterRoute) => {
      setRoute(r);
      setParams({ section: 'newsletter', ...newsletterParams(r) });
    },
    [setParams],
  );
  return (
    <div className={polls.page}>
      {route.tab === 'list' ? (
        <NewsletterList onOpen={(slug) => go({ tab: 'issue', slug, view: 'write' })} onSubscribers={() => go({ tab: 'subscribers' })} />
      ) : route.tab === 'subscribers' ? (
        <SubscribersPanel onBack={() => go({ tab: 'list' })} />
      ) : (
        <IssueEditor key={route.slug} slug={route.slug} view={route.view} onView={(view) => go({ tab: 'issue', slug: route.slug, view })} onBack={() => go({ tab: 'list' })} />
      )}
    </div>
  );
}
