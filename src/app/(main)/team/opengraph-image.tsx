import { pageOgResponse } from '@/lib/ogPage';

// Link-preview card for the Team page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: The team';

export default function Image() {
  return pageOgResponse({ kicker: 'The people', title: 'The team', sub: 'Meet the board, leads and officers.', accent: '#ffc72c' });
}
