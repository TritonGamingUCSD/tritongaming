export interface AlbumPreview {
  title: string | null;
  image: string | null;
}

function extractMeta(html: string, property: string): string | null {
  // Google's markup order (property before content, or vice versa) isn't
  // guaranteed, so match either attribute order rather than assuming one.
  const re1 = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, 'i');
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

// Google Photos sends `X-Frame-Options: SAMEORIGIN` on shared-album pages —
// they can't be embedded in an <iframe> from this site, full stop, no
// workaround. This is the closest practical substitute: a real preview
// (cover photo + title) pulled from the album's own Open Graph tags —
// the same metadata that makes the link look good when pasted into iMessage
// or Discord — rendered as a card here instead of a plain "View Photos"
// text link, with the actual album still just a click away.
export async function getAlbumPreview(url: string): Promise<AlbumPreview | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TritonGamingBot/1.0; +https://tritongaming.org)' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const title = extractMeta(html, 'og:title');
    const image = extractMeta(html, 'og:image');
    if (!title && !image) return null;
    return { title, image };
  } catch {
    return null;
  }
}
