import { getContentBlock } from '@/lib/content';
import AnnouncementClient from './AnnouncementClient';

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  yellow: { bg: 'rgba(255,199,44,0.12)',  text: '#ffc72c',  border: 'rgba(255,199,44,0.25)' },
  blue:   { bg: 'rgba(39,90,143,0.2)',    text: '#9fc4e8',  border: 'rgba(159,196,232,0.2)' },
  green:  { bg: 'rgba(5,150,105,0.15)',   text: '#6ee7b7',  border: 'rgba(52,211,153,0.2)' },
  red:    { bg: 'rgba(220,38,38,0.12)',   text: '#fca5a5',  border: 'rgba(252,165,165,0.2)' },
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

    const colors = COLOR_MAP[content.color || 'yellow'] || COLOR_MAP.yellow;

    return (
      <AnnouncementClient
        text={content.text}
        link={content.link}
        linkText={content.link_text}
        colors={colors}
      />
    );
  } catch {
    return null;
  }
}
