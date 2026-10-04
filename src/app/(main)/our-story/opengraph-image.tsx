import { pageOgResponse } from '@/lib/ogPage';

// Link-preview card for the Our story page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Our story';

export default function Image() {
  return pageOgResponse({ kicker: 'Our story', title: 'Our story', sub: 'Who we are and how we run events.', accent: '#9fc4e8' });
}
