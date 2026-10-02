'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import ContentEditor from '../admin/content/ContentEditor';
import type { ContentBlock } from '@/lib/content-blocks';
import styles from './sitecontent.module.css';

interface Props {
  canEditContent: boolean;
  contentBlocks?: ContentBlock[];
  contentMap?: Record<string, Record<string, unknown>>;
  lastEdited?: Record<string, { by: string; at: string }>;
}

// The editor for page copy and images on the public site. (The divisions directory and "My division"
// live in their own Divisions section now.) ContentEditor has its own category tabs.
export default function SiteContentSectionContent({ canEditContent, contentBlocks, contentMap, lastEdited }: Props) {
  const [query, setQuery] = useState('');
  return (
    <div className={styles.page} data-wide>
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Site Content</h1>
          <p className={styles.titleSub}>Everything that shows up on the public site</p>
        </div>
        {canEditContent && (
          <label className={styles.headerSearch}>
            <Search size={14} aria-hidden="true" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all blocks…" aria-label="Search content blocks" />
          </label>
        )}
      </div>
      {canEditContent && contentBlocks && contentMap && (
        <ContentEditor query={query} setQuery={setQuery} blocks={contentBlocks} contentMap={contentMap} lastEdited={lastEdited ?? {}} />
      )}
    </div>
  );
}
