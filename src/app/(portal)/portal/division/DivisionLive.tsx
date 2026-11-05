'use client';

import dynamic from 'next/dynamic';
import Loading from '@/components/Loading/Loading';
import type { DivisionHat } from '@/components/portal/hubTypes';
import { EmbeddedPortalContext } from '@/lib/portal/usePortalParams';

// The club's tools, loaded only when opened.
const loading = () => <Loading variant="inline" label="Loading…" />;
const TriviaSectionContent = dynamic(() => import('../trivia/TriviaSectionContent'), { loading });
const PollsSectionContent = dynamic(() => import('../polls/PollsSectionContent'), { loading });
const QaSectionContent = dynamic(() => import('../qa/QaSectionContent'), { loading });
const PhotoBoothSectionContent = dynamic(() => import('../photobooth/PhotoBoothSectionContent'), { loading });

export type LiveTool = 'trivia' | 'polls' | 'qa' | 'photobooth';
export const isLiveTool = (id: string | null | undefined): id is LiveTool => id === 'trivia' || id === 'polls' || id === 'qa' || id === 'photobooth';

// One Live Tool as a page of the division (Trivia, Polls, Q&A or Photo Booth, each its own page in the sidebar): the same tool as the club's, shown here so the division stays the open hat (Staffle stays the club's).
// What a Member or Head makes belongs to their division and the lists show only the division's own work. The place inside a tool is not in the address (it starts from the tool's list when the page is reloaded).
export default function DivisionLive({ hat, tool }: { hat: DivisionHat; tool: LiveTool }) {
  return (
    <section aria-label={`${hat.name} ${tool}`}>
      <EmbeddedPortalContext.Provider value={{ division: hat.id }}>
        {tool === 'trivia' && <TriviaSectionContent key="t" canHost />}
        {tool === 'polls' && <PollsSectionContent key="p" />}
        {tool === 'qa' && <QaSectionContent key="q" />}
        {tool === 'photobooth' && <PhotoBoothSectionContent key="b" />}
      </EmbeddedPortalContext.Provider>
    </section>
  );
}
