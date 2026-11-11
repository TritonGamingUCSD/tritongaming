'use client';

import { Hash } from 'lucide-react';
import CodeEntry from '@/components/portal/CodeEntry';
import { useCodeFlow } from '@/components/portal/CodeBox';

// The phone's code box: always in view at the top left (beside the round buttons), so entering a code never needs a tap to open it first. It is the same box as the sidebar's and the top bar's, and sends itself on the sixth digit.
export default function CodeBar() {
  const { submit, busy, dialog } = useCodeFlow();
  return (
    <>
      <CodeEntry compact icon={<Hash />} busy={busy} onSubmit={(c) => void submit(c)} />
      {dialog}
    </>
  );
}
