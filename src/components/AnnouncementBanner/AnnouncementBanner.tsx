import { getContentBlock } from '@/lib/content';
import AnnouncementClient from './AnnouncementClient';

// Strip tones. The dark ones (navy, royal) follow the brand deck: white text, a small yellow tag and a yellow button. Yellow, green and red are light strips with navy text.
const TONES = ['navy', 'royal', 'yellow', 'green', 'red'] as const;
export type BannerTone = (typeof TONES)[number];

export default async function AnnouncementBanner() {
  try {
    // Cookie-free + cached (see lib/content.ts) so this doesn't force every page to render per request.
    const content = (await getContentBlock('announcement')) as {
      enabled?: boolean;
      text?: string;
      link?: string;
      link_text?: string;
      color?: string;
      label?: string;
    };

    if (!content.enabled || !content.text) return null;

    const tone: BannerTone = (TONES as readonly string[]).includes(content.color ?? '') ? (content.color as BannerTone) : 'navy';

    return (
      <AnnouncementClient
        text={content.text}
        link={content.link}
        linkText={content.link_text}
        tone={tone}
        label={content.label || 'News'}
      />
    );
  } catch {
    return null;
  }
}
