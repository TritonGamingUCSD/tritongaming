// Which sections a public page shows, and in what order. Staff set this in Site Content ("Page layout" block per page); the page
// renders the sections it is given. Unknown or missing ids fall back to the default order, so a page can never lose a section by accident.
export interface SectionDef { id: string; label: string }
export interface PageLayout { order?: string[]; hidden?: string[] }

export const PAGE_SECTIONS: Record<string, SectionDef[]> = {
  homepage: [
    { id: 'stats', label: 'Statistics strip' },
    { id: 'about', label: 'About' },
    { id: 'events', label: 'Upcoming events' },
    { id: 'sponsors', label: 'Sponsors strip' },
    { id: 'recruitment', label: 'Get involved cards' },
  ],
  'our-story': [
    { id: 'section1', label: 'Section 1 (Inside TG)' },
    { id: 'section2', label: 'Section 2 (Community)' },
    { id: 'section3', label: 'Section 3 (Events)' },
  ],
  'get-involved': [
    { id: 'ways', label: 'Ways to connect' },
    { id: 'officer', label: 'Officer application' },
  ],
  sponsors: [
    { id: 'mission', label: 'Mission bar' },
    { id: 'sponsors', label: 'Current sponsors' },
    { id: 'offer', label: 'What we offer' },
    { id: 'cta', label: 'Contact call to action' },
  ],
  membership: [
    { id: 'price', label: 'Price and validity bar' },
    { id: 'intro', label: 'Intro and purchase button' },
    { id: 'partners', label: 'Partner discounts' },
  ],
  media: [
    { id: 'videos', label: 'Long-form videos' },
    { id: 'albums', label: 'Photo albums' },
  ],
  events: [
    { id: 'upcoming', label: 'Upcoming events' },
    { id: 'past', label: 'Past events' },
  ],
};

// The section ids to show, in order: the saved order first, then anything not mentioned (e.g. a section added later) in its default spot.
export function resolveSections(page: string, layout: unknown): string[] {
  const defaults = (PAGE_SECTIONS[page] ?? []).map((s) => s.id);
  const l = (layout && typeof layout === 'object' ? layout : {}) as PageLayout;
  const order = Array.isArray(l.order) ? l.order.filter((id) => defaults.includes(id)) : [];
  const all = [...order, ...defaults.filter((id) => !order.includes(id))];
  const hidden = Array.isArray(l.hidden) ? l.hidden : [];
  return all.filter((id) => !hidden.includes(id));
}
