import { pageOgResponse } from '@/lib/ogPage';

// Link-preview card for the Media page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Media';

export default function Image() {
  return pageOgResponse({ kicker: 'Media', title: 'Media', sub: 'Recap videos and photo albums.', accent: '#ffc72c' });
}
