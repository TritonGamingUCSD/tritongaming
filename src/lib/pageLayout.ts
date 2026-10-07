// The sections each public page is made of, in the order they appear on the page.
export interface SectionDef { id: string; label: string }
export interface PageLayout { order?: string[]; hidden?: string[] }

export const PAGE_SECTIONS: Record<string, SectionDef[]> = {
  homepage: [
    { id: 'stats', label: 'Statistics strip' },
    { id: 'about', label: 'About' },
    { id: 'events', label: 'Upcoming events' },
    { id: 'explore', label: 'Explore the site (cards for every page)' },
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
    { id: 'calendar', label: 'Calendar' },
    { id: 'past', label: 'Past events' },
  ],
};

// The section ids to show, in order. Sections can no longer be hidden or moved from Site Content, so every page shows all of its sections in the
// default order (any layout saved earlier is ignored). The second argument is kept so the pages calling this did not need to change.
export function resolveSections(page: string, _layout?: unknown): string[] {
  return (PAGE_SECTIONS[page] ?? []).map((s) => s.id);
}
