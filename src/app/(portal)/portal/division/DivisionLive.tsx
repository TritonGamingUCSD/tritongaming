'use client';

import dynamic from 'next/dynamic';
import { Camera, Gamepad2, MessagesSquare, Vote } from 'lucide-react';
import SectionTabs from '@/components/ui/SectionTabs';
import Loading from '@/components/Loading/Loading';
import type { DivisionHat } from '@/components/portal/hubTypes';
import { EmbeddedPortalContext, usePortalParams } from '@/lib/portal/usePortalParams';
import styles from './divisionLive.module.css';

// The club's tools, loaded only when opened.
const loading = () => <Loading variant="inline" label="Loading…" />;
const TriviaSectionContent = dynamic(() => import('../trivia/TriviaSectionContent'), { loading });
const PollsSectionContent = dynamic(() => import('../polls/PollsSectionContent'), { loading });
const QaSectionContent = dynamic(() => import('../qa/QaSectionContent'), { loading });
const PhotoBoothSectionContent = dynamic(() => import('../photobooth/PhotoBoothSectionContent'), { loading });

const TOOLS = [
  { id: 'trivia', label: 'Trivia', icon: <Gamepad2 size={15} /> },
  { id: 'polls', label: 'Polls', icon: <Vote size={15} /> },
  { id: 'qa', label: 'Q&A', icon: <MessagesSquare size={15} /> },
  { id: 'photobooth', label: 'Photo Booth', icon: <Camera size={15} /> },
] as const;
type ToolId = (typeof TOOLS)[number]['id'];

// A division's Live Tools: the same Trivia, Polls, Q&A and Photo Booth as the club's, shown right here so the division stays the open hat (Staffle stays the club's). What a Member or Head makes belongs to their
// division and they only see their division's. Which tool is open is in the address (/portal/<division>/live/<tool>); the place inside a tool is not (it starts from the tool's list when the page is reloaded).
export default function DivisionLive({ hat, tool }: { hat: DivisionHat; tool: string | null }) {
  const setParams = usePortalParams();
  const open: ToolId = TOOLS.some((t) => t.id === tool) ? (tool as ToolId) : 'trivia';
  return (
    <section className={styles.wrap} aria-label={`${hat.name} Live Tools`}>
      <SectionTabs
        top
        value={open}
        onChange={(id) => {
          setParams({ detail: id === 'trivia' ? null : id });
          window.dispatchEvent(new Event('tg:division-nav'));
        }}
        tabs={TOOLS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
      />
      <p className={styles.note}>
        What you make here belongs to {hat.name}, and you see only {hat.name}’s own work. If you are in more than one division, say which one when you make something.
      </p>
      <EmbeddedPortalContext.Provider value={{ division: hat.id }}>
        {open === 'trivia' && <TriviaSectionContent key="t" canHost />}
        {open === 'polls' && <PollsSectionContent key="p" />}
        {open === 'qa' && <QaSectionContent key="q" />}
        {open === 'photobooth' && <PhotoBoothSectionContent key="b" />}
      </EmbeddedPortalContext.Provider>
    </section>
  );
}
