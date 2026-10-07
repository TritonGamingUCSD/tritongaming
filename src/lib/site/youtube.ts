// Handles watch/share/shorts/embed URL shapes, with or without extra query
// params (?t=, ?si=, playlist context, etc.) — anything YouTube itself would
// produce from its own Share button. Shared by EventSocialEmbeds (social
// post embeds) and the Media page (long-form video embeds) — both need the
// exact same URL parsing, just for different-sized players.
export function youtubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtu\.be\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}
