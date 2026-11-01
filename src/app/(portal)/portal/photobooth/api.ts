import type { BoothConfig, Overlay } from '@/lib/photobooth/booth';

export { call } from '@/lib/ui/apiCall';

export interface BoothRow {
  id: string;
  slug: string;
  name: string;
  layout: string;
  created_at: string;
  photos: number;
}
export interface BoothData {
  booth: { id: string; slug: string; name: string };
  config: BoothConfig;
  overlays: Overlay[];
}
