'use client';

import SectionHeader from '@/components/ui/SectionHeader';
import { useState } from 'react';
import { Search } from 'lucide-react';
import ContentEditor from '../admin/content/ContentEditor';
import type { ContentBlock } from '@/lib/site/content-blocks';
import styles from './sitecontent.module.css';

interface Props {
  canEditContent: boolean;
  contentBlocks?: ContentBlock[];
  contentMap?: Record<string, Record<string, unknown>>;
  lastEdited?: Record<string, { by: string; at: string }>;
  creditPeople?: import('@/lib/members/creditPeople').CreditPerson[];
}

// The editor for page copy and images on the public site. (The divisions directory and "My division"
// live in their own Divisions section now.) ContentEditor has its own category tabs.
export default function SiteContentSectionContent({ canEditContent, contentBlocks, contentMap, lastEdited, creditPeople }: Props) {
  const [query, setQuery] = useState('');
  return (
    <div className={styles.page} data-wide>
      <SectionHeader title="Site Content" sub="Everything that shows up on the public site"
        actions={canEditContent ? (
          <label className={styles.headerSearch}>
            <Search size={14} aria-hidden="true" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all blocks…" aria-label="Search content blocks" />
          </label>
        ) : undefined} />
      {canEditContent && contentBlocks && contentMap && (
        <ContentEditor query={query} setQuery={setQuery} blocks={contentBlocks} contentMap={contentMap} lastEdited={lastEdited ?? {}} creditPeople={creditPeople} />
      )}
    </div>
  );
}
