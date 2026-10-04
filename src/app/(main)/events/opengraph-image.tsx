import { pageOgResponse } from '@/lib/ogPage';

// Link-preview card for the Events page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Events';

export default function Image() {
  return pageOgResponse({ kicker: 'What is on', title: 'Events', sub: 'Find the next one and grab a ticket.', accent: '#ffc72c' });
}
