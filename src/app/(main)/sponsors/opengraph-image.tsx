import { pageOgResponse } from '@/lib/site/ogPage';

// Link-preview card for the Sponsors page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Sponsors';

export default function Image() {
  return pageOgResponse({ kicker: 'Sponsors', title: 'Sponsors', sub: 'Our partners, and how to team up.', accent: '#ffc72c' });
}
