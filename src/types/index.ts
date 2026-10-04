import type { PageBlock } from '@/lib/pageBlocks';
import type { SocialEmbed, PhotoAlbumEntry, ScheduleItem, EventSponsor } from '@/types/database';
import type { EventTheme } from '@/lib/eventTheme';

export type Event = {
  _id: string;
  slug: string;
  full_name: string;
  name: string;
  start_date: string;
  end_date: string;
  flyer_url: string;
  location: string;
  content: string;
  // Comprehensive "learn more" instructions shown on the event's own detail
  // page (sourced from the events.description column).
  details: string;
  url: string;
  requires_ticket: boolean;
  ticket_price: number;
  audience: 'public' | 'ucsd_only';
  photo_albums: PhotoAlbumEntry[];
  post_event_info: string;
  venue_address: string;
  venue_notes: string;
  venue_name: string;
  venue_lat: number | null;
  venue_lng: number | null;
  schedule: ScheduleItem[];
  sponsors: EventSponsor[];
  social_embeds: SocialEmbed[];
  points_value: number;
  // The event's own look from its design guide; null = the default Triton Gaming look.
  theme: EventTheme | null;
  // Extra page sections (highlights, FAQ, gallery, text), shown below the main text.
  page_blocks: PageBlock[];
};

export type LogoItem = {
  name: string;
  logo: string;
  size: 'small' | 'medium' | 'large';
  link?: string;
  order?: number;
  description?: string;
};
