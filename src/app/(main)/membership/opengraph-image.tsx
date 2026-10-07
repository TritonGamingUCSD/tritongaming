import { pageOgResponse } from '@/lib/site/ogPage';

// Link-preview card for the Membership page. The design is PageCard in lib/ogCards.tsx.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Triton Gaming: Membership card';

export default function Image() {
  return pageOgResponse({ kicker: 'Members only', title: 'Membership card', sub: 'The card that saves you money.', accent: '#9fc4e8' });
}
