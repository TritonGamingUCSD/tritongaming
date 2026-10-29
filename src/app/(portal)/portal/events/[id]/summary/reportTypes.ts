import type { EventSummary } from '@/lib/events/eventSummary';
import type { EventSponsor, ReportMetric } from '@/types/database';

export interface ReportPhoto {
  url: string;
  caption: string;
  credit: string;
}

// What the report needs, as plain data: the page builds it on the server and the PDF maker (in the browser) draws it.
export interface ReportData {
  eventId: string;
  title: string;
  when: string;
  prepared: string;
  summary: string;
  multiDay: boolean;
  peakNote: string | null;
  firstRate: number;
  returningRate: number;
  sponsors: EventSponsor[];
  photos: ReportPhoto[];
  social: ReportMetric[];
  canEditSocial: boolean;
  highlights: { label: string; text: string }[];
  poster: string | null;
  stickers: string[];
  s: EventSummary;
}

// What the person making this copy chose, and the pictures ready for the PDF (the PDF maker cannot read WebP, so they are converted first).
export interface ReportChoices {
  preparedFor: { name: string; logo: string | null } | null;
  social: ReportMetric[];
  thanks: { name: string; logo: string | null }[];
  photos: { src: string; caption: string; credit: string }[];
  poster: string | null;
  stickers: string[];
}
