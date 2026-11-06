import type { EntryInfo, PollMode, PollReveal, PollStatus, Standing } from '@/lib/polls/tally';
import { call } from '@/lib/ui/apiCall';
import { safeFetch } from '@/lib/ui/safeFetch';

export { call };
export type { EntryInfo, PollMode, PollReveal, PollStatus, Standing };

export interface PollCard {
  id: string;
  division_id?: string | null;
  slug: string;
  name: string;
  mode: PollMode;
  reveal: PollReveal;
  status: PollStatus;
  code: string | null;
  created_at: string;
  entries: number;
  photos: string[];
  voters: number;
}
export interface PollInfo {
  id: string;
  slug: string;
  name: string;
  mode: PollMode;
  reveal: PollReveal;
  status: PollStatus;
  code: string | null;
}
/** What the host's screens work with: the poll, its entries and the standings so far. */
export interface PollView {
  poll: PollInfo;
  entries: EntryInfo[];
  standings: Standing[];
  voters: number;
}

export const STATUS_NAMES: Record<PollStatus, string> = { draft: 'Draft', open: 'Voting Open', closed: 'Voting Closed', revealed: 'Results Shown' };

/** Sets an entry's picture (a WebP file made small in the browser). */
export async function uploadEntryPicture(slug: string, entry: string, blob: Blob): Promise<{ ok: true; image: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append('file', new File([blob], 'picture.webp', { type: 'image/webp' }));
  const res = await safeFetch(`/api/polls/${slug}/entries/${entry}/image`, { method: 'POST', body: form, cache: 'no-store' }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, image: json.image as string } : { ok: false, error: json.error ?? 'Couldn’t reach the server.' };
}
