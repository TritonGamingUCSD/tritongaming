import { cache } from 'react';

// Per-request holder for the editors' unsaved drafts (Site Content blocks, the event form, the division form). Kept apart from the
// server-only loader (contentPreview.ts) so lib/events, lib/divisions and lib/content can read it without pulling in server code.
// /preview fills it before anything renders; outside /preview it is always empty, so the public site never sees a draft.
export const draftHolder = cache(() => ({ drafts: null as Record<string, Record<string, unknown>> | null }));

export function getPreviewDrafts() {
  return draftHolder().drafts;
}
