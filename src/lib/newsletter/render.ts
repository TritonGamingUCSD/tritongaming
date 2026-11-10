import { blocks as paragraphs, plainOf, button, CREAM, esc, HEAD, BODY, LOGO_CID, MUTED, NAVY, siteUrl, SKY, YELLOW } from '@/lib/email/template';
import { eventWhen, shortText, type EventForEmail } from '@/lib/email/eventData';
import { CARD_KINDS, type Block } from './blocks';
import { ISSUE_TYPES, type IssueType } from './rules';

// An issue as an email (and as its web copy): the club's look (see lib/email/template.ts), then each block in turn, then a footer that says why the person got it and how to stop it. Email clients only trust old HTML (tables, inline
// styles), so the club's hard shadows are thicker bottom and right borders. Pure: no database, no network. The same function makes the preview, the test, the real send and the web copy.

export interface RenderOptions {
  issue: { number: number; title: string; preheader?: string; type: IssueType; date?: Date };
  blocks: Block[];
  events: Map<string, EventForEmail>;
  /** Where the logo comes from: `cid:tglogo` when sent (it travels inside the email), a data address in the preview and the web copy. */
  logoSrc?: string;
  webUrl?: string; // "View in browser"
  unsubscribeUrl?: string;
  settingsUrl?: string;
  /** Why this person got it (the footer's first line). */
  why?: string;
  test?: boolean;
  /** Called with every link in the body; what it returns is what the email links to (the click counter), or the same address. */
  link?: (url: string) => string;
}

const SIZES = { small: 12, medium: 28, large: 52 } as const;
const inkSoft = '#27304a';
const hrefOf = (s: string) => s.replace(/&amp;/g, '&');

function eventCard(e: EventForEmail, note: string): string {
  const when = eventWhen(e);
  const place = e.is_online ? 'Online' : e.location || '';
  const cover =
    e.cover_url && /^https:\/\/[^\s"'<>]+$/i.test(e.cover_url)
      ? `<tr><td><img src="${esc(e.cover_url)}" width="538" alt="${esc(e.title)}" style="display:block;width:100%;height:auto;border:0;border-radius:6px 6px 0 0;"></td></tr>`
      : '';
  const desc = shortText(e.description, 220);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border:2px solid ${NAVY};border-bottom-width:5px;border-right-width:5px;border-radius:8px;">
${cover}<tr><td style="padding:14px 16px;font-family:${BODY};color:${NAVY};">
<div style="font-family:${HEAD};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};font-weight:700;">${esc(when.day)} ${esc(when.date)} · ${esc(when.time)}</div>
<div style="font-family:${HEAD};font-size:20px;font-weight:800;line-height:1.25;margin:4px 0;">${esc(e.title)}</div>
${place ? `<div style="font-size:14px;color:${inkSoft};margin:0 0 6px;">${esc(place)}</div>` : ''}
${desc ? `<div style="font-size:14px;line-height:1.5;margin:0 0 8px;">${esc(desc)}</div>` : ''}
${note ? `<div style="font-size:14px;line-height:1.5;margin:0 0 8px;">${paragraphs(note)}</div>` : ''}
${e.pageUrl ? button('Event Details', e.pageUrl, '6px 0 0') : ''}
</td></tr></table>`;
}

function renderBlock(b: Block, o: RenderOptions): string {
  switch (b.type) {
    case 'heading':
      return b.text
        ? `<h2 style="margin:6px 0 12px;font-family:${HEAD};font-size:${b.size === 'large' ? 22 : 17}px;line-height:1.3;font-weight:800;color:${NAVY};">${esc(b.text)}</h2>`
        : '';
    case 'text':
      return paragraphs(b.text);
    case 'button':
      return b.url && b.label ? button(b.label, b.url) : '';
    case 'image': {
      if (!b.url) return '';
      const img = `<img src="${esc(b.url)}" width="546" alt="${esc(b.alt)}" style="display:block;width:100%;height:auto;border:0;border-radius:6px;">`;
      return `<div style="margin:0 0 18px;">${b.link ? `<a href="${esc(b.link)}">${img}</a>` : img}${b.caption ? `<div style="font-size:13px;color:${MUTED};margin-top:6px;">${esc(b.caption)}</div>` : ''}</div>`;
    }
    case 'event': {
      const e = o.events.get(b.event_id);
      return e ? eventCard(e, b.note) : '';
    }
    case 'columns':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;"><tr>
<td class="tg-col" width="50%" valign="top" style="padding:0 10px 0 0;">${paragraphs(b.left)}</td>
<td class="tg-col" width="50%" valign="top" style="padding:0 0 0 10px;">${paragraphs(b.right)}</td></tr></table>`;
    case 'quote':
      return `<div style="margin:0 0 18px;padding:4px 0 4px 16px;border-left:5px solid ${YELLOW};"><div style="font-family:${HEAD};font-size:19px;line-height:1.4;font-weight:700;color:${NAVY};">“${esc(b.text)}”</div>${b.by ? `<div style="font-size:13px;color:${MUTED};margin-top:4px;">— ${esc(b.by)}</div>` : ''}</div>`;
    case 'card':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${CREAM};border:2px solid ${NAVY};border-bottom-width:5px;border-right-width:5px;border-radius:8px;"><tr><td style="padding:14px 16px;font-family:${BODY};color:${NAVY};">
<div style="font-family:${HEAD};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};font-weight:700;">${esc(CARD_KINDS[b.kind])}</div>
<div style="font-family:${HEAD};font-size:19px;font-weight:800;line-height:1.3;margin:3px 0 4px;">${esc(b.title)}</div>
${b.text ? `<div style="font-size:14px;line-height:1.5;margin:0 0 6px;">${esc(b.text)}</div>` : ''}
${b.url ? button(b.label || 'Open', b.url, '6px 0 0') : ''}</td></tr></table>`;
    case 'people': {
      const rows = b.people.filter((p) => p.name);
      if (!rows.length) return '';
      return `${b.heading ? `<h2 style="margin:6px 0 12px;font-family:${HEAD};font-size:20px;font-weight:800;color:${NAVY};">${esc(b.heading)}</h2>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">${rows
        .map(
          (p) =>
            `<tr><td width="76" valign="top" style="padding:0 12px 12px 0;">${
              p.photo
                ? `<img src="${esc(p.photo)}" width="64" height="64" alt="${esc(p.name)}" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:32px;border:2px solid ${NAVY};">`
                : `<div style="width:64px;height:64px;line-height:64px;border-radius:32px;background:${NAVY};color:${CREAM};font-family:${HEAD};font-size:24px;font-weight:800;text-align:center;">${esc((p.name.trim()[0] ?? '?').toUpperCase())}</div>`
            }</td><td valign="top" style="padding:0 0 12px;font-family:${BODY};font-size:14px;line-height:1.45;color:${NAVY};"><b style="font-family:${HEAD};font-size:16px;">${esc(p.name)}</b>${p.role ? `<br><span style="color:${MUTED};">${esc(p.role)}</span>` : ''}${p.blurb ? `<br>${esc(p.blurb)}` : ''}</td></tr>`,
        )
        .join('')}</table>`;
    }
    case 'divider':
      return `<hr style="border:0;border-top:2px solid ${CREAM};margin:18px 0;">`;
    case 'spacer':
      return `<div style="height:${SIZES[b.size]}px;line-height:${SIZES[b.size]}px;font-size:0;">&nbsp;</div>`;
  }
}

/** One block as plain text (for mail apps that show only text, and for the text part of every email). */
function blockText(b: Block, o: RenderOptions): string {
  switch (b.type) {
    case 'heading':
      return b.text.toUpperCase();
    case 'text':
      return plainOf(b.text);
    case 'button':
      return b.url ? `${b.label}: ${b.url}` : '';
    case 'image':
      return [b.caption || b.alt, b.link].filter(Boolean).join(' ');
    case 'event': {
      const e = o.events.get(b.event_id);
      if (!e) return '';
      const w = eventWhen(e);
      return [e.title, `${w.day} ${w.date}, ${w.time}${e.is_online ? ' · Online' : e.location ? ` · ${e.location}` : ''}`, plainOf(b.note), e.pageUrl].filter(Boolean).join('\n');
    }
    case 'columns':
      return [plainOf(b.left), plainOf(b.right)].filter(Boolean).join('\n\n');
    case 'quote':
      return `“${b.text}”${b.by ? ` — ${b.by}` : ''}`;
    case 'card':
      return [b.title, b.text, b.url].filter(Boolean).join('\n');
    case 'people':
      return [b.heading, ...b.people.filter((p) => p.name).map((p) => [p.name, p.role, p.blurb].filter(Boolean).join(' · '))].filter(Boolean).join('\n');
    case 'divider':
      return '---';
    case 'spacer':
      return '';
  }
}

const RESPONSIVE = `<style>
@media only screen and (max-width:480px){
  .tg-card{padding-left:16px !important;padding-right:16px !important}
  .tg-col{display:block !important;width:100% !important;padding:0 !important}
  .tg-h1{font-size:21px !important}
}
</style>`;

export function renderIssue(o: RenderOptions): { html: string; text: string } {
  const site = siteUrl();
  const logo = o.logoSrc ?? `cid:${LOGO_CID}`;
  const type = ISSUE_TYPES[o.issue.type];
  const date = (o.issue.date ?? new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
  const masthead = o.issue.type === 'newsletter' ? date : `${type.label} · ${date}`; // (the newsletter's own name is already on the line above)
  let body = o.blocks.map((b) => renderBlock(b, o)).join('');
  if (o.link) body = body.replace(/href="(https?:[^"]+)"/g, (_m, u: string) => `href="${esc(o.link!(hrefOf(u)))}"`);
  const pre = (o.issue.preheader || o.blocks.map((b) => blockText(b, o)).join(' ')).replace(/\s+/g, ' ').trim().slice(0, 110);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.issue.title)}</title>${RESPONSIVE}</head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${esc(pre)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    ${o.test ? `<tr><td style="background:${YELLOW};padding:8px 16px;font-family:${HEAD};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${NAVY};text-align:center;border-radius:10px 10px 0 0;">Test copy. Nobody else got this.</td></tr>` : ''}
    <tr><td style="background:${NAVY};border-radius:${o.test ? '0' : '10px 10px 0 0'};padding:20px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:14px;"><img src="${esc(logo)}" width="48" height="48" alt="TG" style="display:block;border:0;border-radius:10px;"></td>
        <td style="font-family:${HEAD};color:${CREAM};font-size:13px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;line-height:1.35;">Triton Gaming ${o.issue.type === 'newsletter' ? 'Newsletter' : 'Events'}<br><span style="color:${YELLOW};letter-spacing:0.16em;font-size:11px;">${esc(masthead)}</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="height:6px;background:${YELLOW};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td class="tg-card" style="background:#ffffff;border:2px solid ${NAVY};border-top:0;border-bottom-width:6px;border-right-width:6px;padding:28px 26px 14px;font-family:${BODY};font-size:16px;line-height:1.6;color:${NAVY};word-wrap:break-word;overflow-wrap:anywhere;">
      <h1 class="tg-h1" style="margin:0 0 18px;font-family:${HEAD};font-size:26px;line-height:1.25;font-weight:800;color:${NAVY};">${esc(o.issue.title)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:18px 6px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
      ${o.why ? `${esc(o.why)}<br>` : ''}${o.webUrl ? `<a href="${esc(o.webUrl)}" style="color:${SKY};text-decoration:underline;">View in your browser</a>${o.unsubscribeUrl ? ' · ' : ''}` : ''}${o.unsubscribeUrl ? `<a href="${esc(o.unsubscribeUrl)}" style="color:${SKY};text-decoration:underline;">Unsubscribe</a>${o.settingsUrl ? ' · ' : ''}` : ''}${o.settingsUrl ? `<a href="${esc(o.settingsUrl)}" style="color:${SKY};text-decoration:underline;">Email settings</a>` : ''}<br>
      <a href="${esc(site)}" style="color:${SKY};text-decoration:underline;">${esc(site.replace(/^https?:\/\//, ''))}</a> · Triton Gaming, Gaming Org at UC San Diego
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = [
    `${o.issue.title}\n${masthead}`,
    ...o.blocks.map((b) => blockText(b, o)).filter(Boolean),
    [
      '—',
      'Triton Gaming · Gaming Org at UC San Diego',
      site.replace(/^https?:\/\//, ''),
      o.why ?? '',
      o.webUrl ? `View in your browser: ${o.webUrl}` : '',
      o.unsubscribeUrl ? `Unsubscribe: ${o.unsubscribeUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  ].join('\n\n');
  return { html, text };
}
