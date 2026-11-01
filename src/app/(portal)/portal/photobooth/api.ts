import type { BoothConfig, Overlay } from '@/lib/photobooth/booth';

export { call } from '@/lib/ui/apiCall';

export interface BoothEventRow {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  hasBooth: boolean;
  photos: number;
}
export interface BoothData {
  event: { id: string; title: string; slug: string | null; start_date: string };
  config: BoothConfig;
  overlays: Overlay[];
  saved: boolean;
}

/** The address word of an event in the portal's addresses. */
export const eventKey = (e: { slug: string | null; id: string }) => e.slug ?? e.id;
