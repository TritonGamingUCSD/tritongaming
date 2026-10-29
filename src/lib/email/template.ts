// The one look every email from the club has: the site's navy, yellow and cream, the TG logo on a sticker, a heading, the message, and a footer. Email clients only trust old-fashioned HTML
// (tables, inline styles, no web fonts, no box-shadow), so the "hard shadow" of the site is drawn with a thicker bottom and right border. Client-safe: the admin panel previews it.
//
// The message is plain text with a few conveniences: a blank line starts a paragraph; lines starting with "- " make a list; web addresses become links; [text](https://…) is a link, and a
// line that is only such a link becomes a yellow button. Everything is escaped first, and only http(s) and mailto links are ever made.

export const LOGO_CID = 'tglogo';
export const NAVY = '#011941',
  YELLOW = '#ffc72c',
  CREAM = '#f3f1ea',
  SKY = '#0a4c8a',
  MUTED = '#4b5a78';
export const HEAD = "'Futura','Century Gothic','Trebuchet MS',Arial,sans-serif";
export const BODY = "'Futura','Century Gothic','Segoe UI',Helvetica,Arial,sans-serif";

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u: string) => (/^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(u) ? u : null);
export const siteUrl = () => (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL) || 'https://tritongaming.org';

const linkStyle = `color:${SKY};text-decoration:underline;`;

/** One piece of a line: [text](url), a bare address, or plain text, all escaped. */
function inline(line: string): string {
  let out = '',
    i = 0;
  const re = /\[([^\]]{1,120})\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/gi;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    out += esc(line.slice(i, m.index));
    const url = safeUrl(m[2] ?? m[3]),
      label = m[1] ?? m[3];
    out += url ? `<a href="${esc(url)}" style="${linkStyle}">${esc(label)}</a>` : esc(m[0]);
    i = m.index + m[0].length;
  }
  return out + esc(line.slice(i));
}

export const button = (label: string, url: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr><td style="background:${YELLOW};border:2px solid ${NAVY};border-bottom-width:5px;border-right-width:5px;border-radius:6px;"><a href="${esc(url)}" style="display:inline-block;padding:11px 22px;font-family:${HEAD};font-size:15px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${NAVY};text-decoration:none;">${esc(label)}</a></td></tr></table>`;

export function blocks(message: string): string {
  return message
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trimEnd());
      const solo = lines.length === 1 && lines[0].match(/^\[([^\]]{1,120})\]\(([^)\s]+)\)$/);
      if (solo && safeUrl(solo[2])) return button(solo[1], solo[2]);
      if (lines.every((l) => /^[-*•]\s+/.test(l))) {
        return `<ul style="margin:0 0 18px;padding:0 0 0 22px;">${lines.map((l) => `<li style="margin:0 0 6px;">${inline(l.replace(/^[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p style="margin:0 0 16px;">${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

/** Plain-text version: the message as written, plus the footer. */
export function emailText(message: string): string {
  return `${message.trim()}\n\n—\nTriton Gaming · Gaming Org at UC San Diego\n${siteUrl().replace(/^https?:\/\//, '')}\n`;
}

/** The full HTML email. `logoSrc` is where the logo comes from: `cid:tglogo` when sent (the image travels inside the email, so it never depends on our site being reachable), a data: address in the preview. */
export function emailHtml({ subject, message, preheader = '', logoSrc = `cid:${LOGO_CID}` }: { subject: string; message: string; preheader?: string; logoSrc?: string }): string {
  const site = siteUrl();
  const pre = (preheader || message.replace(/\s+/g, ' ').trim()).slice(0, 110);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${esc(pre)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="background:${NAVY};border-radius:10px 10px 0 0;padding:20px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:14px;"><img src="${esc(logoSrc)}" width="48" height="48" alt="TG" style="display:block;border:0;border-radius:10px;"></td>
        <td style="font-family:${HEAD};color:${CREAM};font-size:13px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;line-height:1.35;">Triton Gaming<br><span style="color:${YELLOW};letter-spacing:0.16em;font-size:11px;">Gaming Org at UC San Diego</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="height:6px;background:${YELLOW};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="background:#ffffff;border:2px solid ${NAVY};border-top:0;border-bottom-width:6px;border-right-width:6px;padding:28px 26px 14px;font-family:${BODY};font-size:16px;line-height:1.6;color:${NAVY};">
      <h1 style="margin:0 0 18px;font-family:${HEAD};font-size:24px;line-height:1.25;font-weight:800;color:${NAVY};">${esc(subject)}</h1>
      ${blocks(message)}
    </td></tr>
    <tr><td style="padding:18px 6px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
      <a href="${esc(site)}" style="color:${SKY};text-decoration:underline;">${esc(site.replace(/^https?:\/\//, ''))}</a><br>
      Sent by the Triton Gaming team.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
