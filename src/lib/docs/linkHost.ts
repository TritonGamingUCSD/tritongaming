// "Google Drive", "Google Sheets"... for a quick link's address, or just its site name.
export function linkHost(url: string | null): string {
  if (!url) return 'Link';
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'drive.google.com') return 'Google Drive';
    if (h === 'docs.google.com') return u.pathname.startsWith('/spreadsheets') ? 'Google Sheets' : u.pathname.startsWith('/forms') ? 'Google Forms' : u.pathname.startsWith('/presentation') ? 'Google Slides' : 'Google Docs';
    if (h === 'forms.gle') return 'Google Forms';
    return h;
  } catch { return 'Link'; }
}
