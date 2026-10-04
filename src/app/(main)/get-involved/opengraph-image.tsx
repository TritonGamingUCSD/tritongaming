import { pageOgResponse } from '@/lib/ogPage';

// Link-preview card for the Get involved page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Get involved';

export default function Image() {
  return pageOgResponse({ kicker: 'Join us', title: 'Get involved', sub: 'Join the Discord or apply to be an officer.', accent: '#9fc4e8' });
}
