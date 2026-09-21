import type { SocialEmbed } from '@/types/database';

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
  photo_album_url: string;
  post_event_info: string;
  social_embeds: SocialEmbed[];
  points_value: number;
};

export type LogoItem = {
  name: string;
  logo: string;
  size: 'small' | 'medium' | 'large';
  link?: string;
  order?: number;
  description?: string;
};
