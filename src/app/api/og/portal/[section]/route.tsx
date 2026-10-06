import { pageOgResponse } from '@/lib/ogPage';
import { PORTAL_PAGE_INFO } from '@/lib/portalShare';

// The link-preview card for a portal page: only its name, never anything from inside it.
export async function GET(_req: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const info = PORTAL_PAGE_INFO[section] ?? { name: 'Member Portal', sub: 'Sign in to open this page.', accent: '#4a90d9' };
  return pageOgResponse({ kicker: 'Member portal', title: info.name, sub: info.sub, accent: info.accent });
}
