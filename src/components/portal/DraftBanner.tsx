'use client';

import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { draftAge } from '@/lib/useDraft';

// "You have an unfinished draft": shown when a form that autosaves is opened again.
export default function DraftBanner({ at, what = 'draft', onContinue, onDiscard }: { at: number; what?: string; onContinue: () => void; onDiscard: () => void }) {
  return (
    <Notice tone="info">
      <strong>Continue your {what}?</strong> You started one {draftAge(at)} and did not finish it.{' '}
      <span style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: '0.4rem' }}>
        <Button size="sm" onClick={onContinue}>Continue</Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>Start over</Button>
      </span>
    </Notice>
  );
}
