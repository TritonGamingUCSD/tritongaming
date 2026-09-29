import type { MetadataRoute } from 'next';
import { getAllEvents } from '@/lib/events';
import { getDivisions } from '@/lib/divisions';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Static (main) routes + every published event and division that actually
// has a real public URL — an event with no slug isn't linked to anywhere
// else in the app either (see e.g. divisions/[slug]/page.tsx's own event
// list, which only renders a Link when `e.slug` is set), so it's skipped
// here too rather than listing a URL nothing else points at.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, divisions] = await Promise.all([
    getAllEvents(1000),
    getDivisions(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/events`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/divisions`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/sponsors`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/get-involved`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/our-story`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const eventRoutes: MetadataRoute.Sitemap = events
    .filter((e) => e.slug)
    .map((e) => ({
      url: `${SITE_URL}/events/${e.slug}`,
      lastModified: e.start_date ? new Date(e.start_date) : undefined,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  const divisionRoutes: MetadataRoute.Sitemap = divisions.map((d) => ({
    url: `${SITE_URL}/divisions/${d.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...eventRoutes, ...divisionRoutes];
}
