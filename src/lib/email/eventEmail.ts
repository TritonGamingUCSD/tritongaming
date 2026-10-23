import { PACIFIC_TZ } from '@/lib/core/timezone';
import { blocks, button, CREAM, esc, HEAD, BODY, LOGO_CID, MUTED, NAVY, SKY, siteUrl, YELLOW } from './template';
import type { EmailKind } from './prefs';

// The email for one event, in the club's look (see template.ts) with the event on show: its cover image, a paper-ticket block with the date, time and place, an optional note from the person
// sending, a yellow "Show my ticket" button, and a footer that says why the person got it and how to stop it. Email clients only trust old HTML (tables, inline styles), so the date block's
// hard shadow is a thicker bottom and right border, as in the standard template.

export interface EventForEmail {
  title: string; start_date: string; end_date?: string | null; location: string | null; is_online: boolean; cover_url: string | null; slug?: string | null;
  // From the event page, all optional: shown only when the event has them.
  description?: string | null; venue_address?: string | null; venue_notes?: string | null;
  schedule?: { time: string; title: string }[]; sponsors?: string[]; audience?: string | null; ticket_price?: number | null; pageUrl?: string;
}
export interface EventEmailOptions {
  event: EventForEmail; kind: EmailKind; subject: string; note: string;
  ticketUrl: string; unsubscribeUrl: string; settingsUrl: string; logoSrc?: string; test?: boolean; showCover?: boolean;
}

const KIND_LABEL: Record<EmailKind, string> = { reminders: 'Reminder', updates: 'Update', newsletter: 'Newsletter' };
const KIND_WHY: Record<EmailKind, string> = { reminders: 'event reminders', updates: 'event updates', newsletter: 'the newsletter' };
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: PACIFIC_TZ, ...o });

/** The pieces of the date block, in Pacific time: "SAT", "Oct 24", "3:00 PM". */
export function eventWhen(e: Pick<EventForEmail, 'start_date' | 'end_date'>) {
  const day = fmt(e.start_date, { weekday: 'short' }).toUpperCase();
  const date = fmt(e.start_date, { month: 'short', day: 'numeric' });
  const start = fmt(e.start_date, { hour: 'numeric', minute: '2-digit' });
  const end = e.end_date ? fmt(e.end_date, { hour: 'numeric', minute: '2-digit' }) : '';
  return { day, date, time: end && end !== start ? `${start} – ${end}` : start };
}

/** The description as a few plain lines: markdown marks removed, cut at a word, with "…" when cut. */
export function shortText(s: string | null | undefined, max = 280): string {
  const plain = String(s ?? '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_`>~]+/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max).replace(/\s+\S*$/, '');
  return `${cut}…`;
}
const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const priceLine = (e: EventForEmail) => [e.ticket_price ? `$${Number.isInteger(e.ticket_price) ? e.ticket_price : e.ticket_price.toFixed(2)} ticket` : 'Free', e.audience === 'ucsd_only' ? 'UCSD students only' : ''].filter(Boolean).join(' · ');

export const eventEmailSubject = (kind: EmailKind, title: string) => (kind === 'reminders' ? `${title} is coming up` : kind === 'updates' ? `An update about ${title}` : title);

const label = (s: string) => `<div style="font-family:${HEAD};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};margin:0 0 3px;">${esc(s)}</div>`;
function infoBlocks(e: EventForEmail): string {
  const out: string[] = [];
  const desc = shortText(e.description);
  if (desc) out.push(`<div style="margin:0 0 12px;">${label('About')}<div style="font-size:14px;line-height:1.5;">${esc(desc)}${e.pageUrl ? ` <a href="${esc(e.pageUrl)}" style="color:${SKY};text-decoration:underline;white-space:nowrap;">Read more</a>` : ''}</div></div>`);
  const addr = [e.venue_address].filter(Boolean).join(' ');
  if (!e.is_online && (addr || e.venue_notes)) out.push(`<div style="margin:0 0 12px;">${label('Where')}<div style="font-size:14px;line-height:1.5;">${addr ? `${esc(addr)} <a href="${esc(mapsUrl(addr))}" style="color:${SKY};text-decoration:underline;white-space:nowrap;">Open in Maps</a>` : ''}${e.venue_notes ? `<div style="color:${MUTED};font-size:13px;">${esc(shortText(e.venue_notes, 240))}</div>` : ''}</div></div>`);
  const sched = (e.schedule ?? []).filter((s) => s.time || s.title).slice(0, 6);
  if (sched.length) out.push(`<div style="margin:0 0 12px;">${label('Schedule')}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.45;">${sched.map((s) => `<tr><td style="padding:0 12px 2px 0;white-space:nowrap;font-weight:700;vertical-align:top;">${esc(s.time)}</td><td style="padding:0 0 2px;">${esc(s.title)}</td></tr>`).join('')}</table></div>`);
  const sp = (e.sponsors ?? []).filter(Boolean).slice(0, 8);
  out.push(`<div style="margin:0 0 12px;">${label('Good to know')}<div style="font-size:14px;line-height:1.5;">${esc(priceLine(e))}${sp.length ? `<br>With ${esc(sp.join(', '))}` : ''}</div></div>`);
  return out.join('');
}

export function eventEmailHtml(o: EventEmailOptions): string {
  const { event: e } = o;
  const when = eventWhen(e);
  const place = e.is_online ? 'Online' : e.location || '';
  const site = siteUrl();
  const logo = o.logoSrc ?? `cid:${LOGO_CID}`;
  // The cover is a small picture inside the ticket block (never a full-width banner): it adds the event's look without pushing the message down, and the email stays mostly text.
  const cover = o.showCover !== false && e.cover_url && /^https:\/\/[^\s"'<>]+$/i.test(e.cover_url)
    ? `<td width="88" align="right" valign="middle" style="padding:8px 8px 8px 0;"><img src="${esc(e.cover_url)}" width="76" alt="${esc(e.title)} poster" style="display:block;width:76px;height:auto;max-height:130px;border:2px solid ${NAVY};"></td>`
    : '';
  const pre = `${e.title} · ${when.day} ${when.date}, ${when.time}${place ? ` · ${place}` : ''}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${esc(pre.slice(0, 110))}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};"><tr><td align="center" style="padding:16px 10px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
    ${o.test ? `<tr><td style="background:${YELLOW};color:${NAVY};font-family:${HEAD};font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;text-align:center;padding:6px;">Test email: nobody else got this</td></tr>` : ''}
    <tr><td style="background:${NAVY};border-radius:8px 8px 0 0;padding:10px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;"><img src="${esc(logo)}" width="32" height="32" alt="TG" style="display:block;border:0;border-radius:8px;"></td>
        <td style="font-family:${HEAD};color:${CREAM};font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">Triton Gaming</td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;background:${YELLOW};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="background:#ffffff;border:2px solid ${NAVY};border-top:0;border-bottom-width:5px;border-right-width:5px;padding:18px 20px 8px;font-family:${BODY};font-size:15px;line-height:1.55;color:${NAVY};">
      <span style="display:inline-block;background:${YELLOW};border:2px solid ${NAVY};font-family:${HEAD};font-size:10px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;padding:2px 8px;">${esc(KIND_LABEL[o.kind])}</span>
      <h1 style="margin:10px 0 12px;font-family:${HEAD};font-size:22px;line-height:1.2;font-weight:800;color:${NAVY};">${esc(e.title)}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;border:2px solid ${NAVY};border-bottom-width:4px;border-right-width:4px;background:${CREAM};"><tr>
        <td width="76" align="center" style="padding:10px 6px;border-right:2px dashed ${NAVY};font-family:${HEAD};">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;color:${MUTED};">${esc(when.day)}</div>
          <div style="font-size:19px;font-weight:800;line-height:1.15;color:${NAVY};">${esc(when.date)}</div>
        </td>
        <td style="padding:10px 12px;font-family:${BODY};font-size:14px;line-height:1.45;color:${NAVY};">
          <b style="white-space:nowrap;">${esc(when.time)}</b> <span style="font-size:12px;color:${MUTED};">Pacific</span>${place ? `<br>${esc(place)}` : ''}
        </td>
        ${cover}
      </tr></table>
      ${o.note.trim() ? blocks(o.note) : ''}
      ${infoBlocks(e)}
      ${button('Show my ticket', o.ticketUrl)}
    </td></tr>
    <tr><td style="padding:12px 6px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
      You are getting this because you have a ticket to ${esc(e.title)}.<br>
      <a href="${esc(o.unsubscribeUrl)}" style="color:${SKY};text-decoration:underline;">Stop ${esc(KIND_WHY[o.kind])} emails</a> · <a href="${esc(o.settingsUrl)}" style="color:${SKY};text-decoration:underline;">Email settings</a><br>
      <a href="${esc(site)}" style="color:${SKY};text-decoration:underline;">${esc(site.replace(/^https?:\/\//, ''))}</a> · Gaming Org at UC San Diego
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** The plain-text version of the same email. */
export function eventEmailText(o: EventEmailOptions): string {
  const when = eventWhen(o.event);
  const place = o.event.is_online ? 'Online' : o.event.location || '';
  return [
    o.test ? '[TEST EMAIL: nobody else got this]\n' : '',
    `${KIND_LABEL[o.kind].toUpperCase()}: ${o.event.title}`,
    `${when.day} ${when.date} · ${when.time} (Pacific)${place ? ` · ${place}` : ''}`,
    o.note.trim() ? `\n${o.note.trim()}` : '',
    shortText(o.event.description) ? `\nAbout: ${shortText(o.event.description)}${o.event.pageUrl ? ` ${o.event.pageUrl}` : ''}` : '',
    !o.event.is_online && o.event.venue_address ? `Where: ${o.event.venue_address} ${mapsUrl(o.event.venue_address)}` : '',
    (o.event.schedule ?? []).length ? `Schedule:\n${(o.event.schedule ?? []).slice(0, 6).map((s) => `  ${s.time} ${s.title}`).join('\n')}` : '',
    `Good to know: ${priceLine(o.event)}${(o.event.sponsors ?? []).length ? `. With ${(o.event.sponsors ?? []).join(', ')}` : ''}`,
    `\nShow my ticket: ${o.ticketUrl}`,
    `\n—\nYou are getting this because you have a ticket to ${o.event.title}.\nStop ${KIND_WHY[o.kind]} emails: ${o.unsubscribeUrl}\nEmail settings: ${o.settingsUrl}\nTriton Gaming · Gaming Org at UC San Diego\n${siteUrl().replace(/^https?:\/\//, '')}\n`,
  ].filter((x) => x !== '').join('\n');
}
