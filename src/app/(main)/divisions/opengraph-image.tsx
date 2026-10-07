import { pageOgResponse } from '@/lib/site/ogPage';

// Link-preview card for the Divisions page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Our divisions';

export default function Image() {
  return pageOgResponse({ kicker: 'Divisions', title: 'Our divisions', sub: 'One community for every game.', accent: '#9fc4e8' });
}
