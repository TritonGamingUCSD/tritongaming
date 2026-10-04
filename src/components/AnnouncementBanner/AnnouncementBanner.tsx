import { getContentBlock } from '@/lib/content';
import AnnouncementClient from './AnnouncementClient';

// Flat strip colours (ink text on all of them). The CMS still picks one of the four.
const COLOR_MAP: Record<string, string> = {
  yellow: '#ffc72c',
  blue: '#9fc4e8',
  green: '#6ee7b7',
  red: '#fca5a5',
};

export default async function AnnouncementBanner() {
  try {
    // Cookie-free + cached (see lib/content.ts) so this doesn't force every page to render per request.
    const content = (await getContentBlock('announcement')) as {
      enabled?: boolean;
      text?: string;
      link?: string;
      link_text?: string;
      color?: string;
    };

    if (!content.enabled || !content.text) return null;

    const color = COLOR_MAP[content.color || 'yellow'] || COLOR_MAP.yellow;

    return (
      <AnnouncementClient
        text={content.text}
        link={content.link}
        linkText={content.link_text}
        color={color}
      />
    );
  } catch {
    return null;
  }
}
