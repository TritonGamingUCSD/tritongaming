import { PACIFIC_TZ } from '@/lib/core/timezone';
import { blocks, esc, HEAD, BODY, LOGO_CID, NAVY, SKY, siteUrl, YELLOW } from './template';
import type { EmailKind } from './prefs';

// The email for one event, in the club's look (see template.ts) with the event on show: its cover image, a paper-ticket block with the date, time and place, an optional note from the person
// sending, a yellow "Show my ticket" button, and a footer that says why the person got it and how to stop it. Email clients only trust old HTML (tables, inline styles), so the date block's
// hard shadow is a thicker bottom and right border, as in the standard template.

export interface EventForEmail {
  title: string; start_date: string; end_date?: string | null; location: string | null; is_online: boolean; cover_url: string | null; slug?: string | null;
  // From the event page, all optional: shown only when the event has them.
  description?: string | null; venue_address?: string | null; venue_notes?: string | null;
  schedule?: { time: string; title: string }[]; sponsors?: { name: string; url?: string }[]; day_hours?: { day: string; start: string; end: string }[]; audience?: string | null; ticket_price?: number | null; pageUrl?: string;
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
// A calmer palette than the club's standard email: soft ink instead of saturated navy, warm paper, thin grey lines, no yellow fills.
const INK = '#27304a', MUTED = '#6a7285', PAPER = '#f5f4f1', LINE = '#dedbd3', SOFT = '#ece9e0', LINK = '#3b5b8c';
const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const priceLine = (e: EventForEmail) => [e.ticket_price ? `$${Number.isInteger(e.ticket_price) ? e.ticket_price : e.ticket_price.toFixed(2)} ticket` : 'Free', e.audience === 'ucsd_only' ? 'UCSD students only' : ''].filter(Boolean).join(' · ');

export const eventEmailSubject = (kind: EmailKind, title: string) => (kind === 'reminders' ? `${title} is coming up` : kind === 'updates' ? `An update about ${title}` : title);

const label = (s: string) => `<div style="font-family:${HEAD};font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};margin:0 0 3px;">${esc(s)}</div>`;
function infoBlocks(e: EventForEmail): string {
  const out: string[] = [];
  const desc = shortText(e.description, 700);
  if (desc) out.push(`<div style="margin:0 0 12px;">${label('About')}<div style="font-size:14px;line-height:1.5;">${esc(desc)}${e.pageUrl ? ` <a href="${esc(e.pageUrl)}" style="color:${LINK};text-decoration:underline;white-space:nowrap;">Read more</a>` : ''}</div></div>`);
  const addr = [e.venue_address].filter(Boolean).join(' ');
  if (!e.is_online && (addr || e.venue_notes)) out.push(`<div style="margin:0 0 12px;">${label('Where')}<div style="font-size:14px;line-height:1.5;">${addr ? `${esc(addr)} <a href="${esc(mapsUrl(addr))}" style="color:${LINK};text-decoration:underline;white-space:nowrap;">Open in Maps</a>` : ''}${e.venue_notes ? `<div style="color:${MUTED};font-size:13px;">${esc(shortText(e.venue_notes, 500))}</div>` : ''}</div></div>`);
  const sched = (e.schedule ?? []).filter((s) => s.time || s.title);
  const hours = (e.day_hours ?? []).filter((h) => h.day);
  if (sched.length) out.push(`<div style="margin:0 0 12px;">${label('Schedule')}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.45;">${sched.map((s) => `<tr><td style="padding:0 12px 2px 0;white-space:nowrap;font-weight:700;vertical-align:top;">${esc(s.time)}</td><td style="padding:0 0 2px;">${esc(s.title)}</td></tr>`).join('')}</table></div>`);
  if (hours.length) out.push(`<div style="margin:0 0 12px;">${label('Hours')}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.45;">${hours.map((h) => `<tr><td style="padding:0 12px 2px 0;white-space:nowrap;font-weight:700;vertical-align:top;">${esc(h.day)}</td><td style="padding:0 0 2px;">${esc([h.start, h.end].filter(Boolean).join(' – '))}</td></tr>`).join('')}</table></div>`);
  out.push(`<div style="margin:0 0 12px;">${label('Good to know')}<div style="font-size:14px;line-height:1.5;">${esc(priceLine(e))}</div></div>`);
  const sp = (e.sponsors ?? []).filter((x) => x.name);
  if (sp.length) out.push(`<div style="margin:0 0 12px;">${label(sp.length === 1 ? 'Sponsor' : 'Sponsors')}<div style="font-size:14px;line-height:1.6;">${sp.map((x) => (x.url && /^https?:\/\/[^\s"'<>]+$/i.test(x.url) ? `<a href="${esc(x.url)}" style="color:${LINK};text-decoration:underline;">${esc(x.name)}</a>` : esc(x.name))).join(' &middot; ')}</div></div>`);
  return out.join('');
}


// Phones get the email edge to edge with snugger padding (mail apps that read a <style> block, such as Gmail and Apple Mail, apply it; the rest still get the fluid, max-600px layout from the inline styles).
const RESPONSIVE_CSS = `<style>
@media only screen and (max-width:480px){
  .tg-outer{padding:0 !important}
  .tg-card{padding-left:14px !important;padding-right:14px !important}
  .tg-h1{font-size:20px !important}
  .tg-org{display:block !important}
  .tg-dot{display:none !important}
  .tg-stub{width:62px !important;padding:8px 4px !important}
  .tg-cover{width:64px !important;padding:6px 6px 6px 0 !important}
  .tg-cover-img{width:56px !important}
}
@media only screen and (min-width:481px){ .tg-card{padding-left:28px !important;padding-right:28px !important} }
</style>`;

export function eventEmailHtml(o: EventEmailOptions): string {
  const { event: e } = o;
  const when = eventWhen(e);
  const place = e.is_online ? 'Online' : e.location || '';
  const site = siteUrl();
  const logo = o.logoSrc ?? `cid:${LOGO_CID}`;
  // The cover is a small picture inside the date block (never a full-width banner): it adds the event's look without pushing the message down, and the email stays mostly text.
  const cover = o.showCover !== false && e.cover_url && /^https:\/\/[^\s"'<>]+$/i.test(e.cover_url)
    ? `<td width="88" align="right" valign="middle" class="tg-cover" style="padding:8px 8px 8px 0;"><img class="tg-cover-img" src="${esc(e.cover_url)}" width="76" alt="${esc(e.title)} poster" style="display:block;width:76px;height:auto;max-height:130px;border:1px solid ${LINE};border-radius:4px;"></td>`
    : '';
  const pre = `Triton Gaming: ${e.title} · ${when.day} ${when.date}, ${when.time}${place ? ` · ${place}` : ''}`;
  // A note written in the shared template's strong colors is toned down to this email's calm ones.
  const note = o.note.trim() ? blocks(o.note).split(NAVY).join(INK).split(YELLOW).join(SOFT).split(SKY).join(LINK) : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.subject)}</title>${RESPONSIVE_CSS}</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${esc(pre.slice(0, 110))}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};"><tr><td align="center" class="tg-outer" style="padding:20px 10px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="tg-wrap" style="width:100%;max-width:680px;">
    ${o.test ? `<tr><td style="background:${SOFT};color:${INK};font-family:${HEAD};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-align:center;padding:6px;border-radius:6px 6px 0 0;">Test email: nobody else got this</td></tr>` : ''}
    <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:8px;padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td bgcolor="${NAVY}" style="background:${NAVY};border-radius:7px 7px 0 0;padding:16px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="54" style="padding-right:12px;"><img src="${esc(logo)}" width="42" height="42" alt="Triton Gaming" style="display:block;border:0;border-radius:10px;"></td>
            <td style="font-family:${HEAD};line-height:1.35;"><span class="tg-brand" style="color:#ffffff;font-size:16px;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;">Triton Gaming</span><span class="tg-org" style="color:#c9ccd6;font-size:12px;font-weight:600;white-space:nowrap;"><span class="tg-dot"> &nbsp;·&nbsp; </span>Gaming Org at UC San Diego</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="height:3px;background:${YELLOW};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td class="tg-card" style="padding:20px 22px 6px;font-family:${BODY};font-size:15px;line-height:1.55;color:${INK};">
          <div style="margin:0 0 6px;font-family:${HEAD};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${MUTED};">${esc(KIND_LABEL[o.kind])}</div>
          <h1 class="tg-h1" style="margin:0 0 16px;font-family:${HEAD};font-size:22px;line-height:1.25;font-weight:700;color:${INK};">${esc(e.title)}</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;border:1px solid ${LINE};border-left:4px solid ${YELLOW};border-radius:6px;background:${PAPER};"><tr>
            <td width="76" align="center" class="tg-stub" style="padding:10px 6px;border-right:1px solid ${LINE};font-family:${HEAD};">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:${MUTED};">${esc(when.day)}</div>
              <div style="font-size:18px;font-weight:700;line-height:1.15;color:${INK};">${esc(when.date)}</div>
            </td>
            <td style="padding:10px 14px;font-family:${BODY};font-size:14px;line-height:1.45;color:${INK};">
              <b style="white-space:nowrap;">${esc(when.time)}</b> <span style="font-size:12px;color:${MUTED};">Pacific</span>${place ? `<br>${esc(place)}` : ''}
            </td>
            ${cover}
          </tr></table>
          ${note}
          ${infoBlocks(e)}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px"><tr><td style="background:${NAVY};border-radius:6px;"><a href="${esc(o.ticketUrl)}" style="display:inline-block;padding:11px 22px;font-family:${HEAD};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Show my ticket</a></td></tr></table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 6px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
      You are getting this because you have a ticket to ${esc(e.title)}.<br>
      <a href="${esc(o.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Stop ${esc(KIND_WHY[o.kind])} emails</a> · <a href="${esc(o.settingsUrl)}" style="color:${MUTED};text-decoration:underline;">Email settings</a><br>
      <a href="${esc(site)}" style="color:${MUTED};text-decoration:underline;">${esc(site.replace(/^https?:\/\//, ''))}</a> · Gaming Org at UC San Diego
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
    shortText(o.event.description, 700) ? `\nAbout: ${shortText(o.event.description, 700)}${o.event.pageUrl ? ` ${o.event.pageUrl}` : ''}` : '',
    !o.event.is_online && o.event.venue_address ? `Where: ${o.event.venue_address} ${mapsUrl(o.event.venue_address)}` : '',
    (o.event.schedule ?? []).length ? `Schedule:\n${(o.event.schedule ?? []).map((s) => `  ${s.time} ${s.title}`).join('\n')}` : '',
    (o.event.day_hours ?? []).filter((h) => h.day).length ? `Hours:\n${(o.event.day_hours ?? []).filter((h) => h.day).map((h) => `  ${h.day} ${[h.start, h.end].filter(Boolean).join(' – ')}`).join('\n')}` : '',
    `Good to know: ${priceLine(o.event)}`,
    (o.event.sponsors ?? []).some((x) => x.name) ? `Sponsors: ${(o.event.sponsors ?? []).filter((x) => x.name).map((x) => x.name).join(', ')}` : '',
    `\nShow my ticket: ${o.ticketUrl}`,
    `\n—\nYou are getting this because you have a ticket to ${o.event.title}.\nStop ${KIND_WHY[o.kind]} emails: ${o.unsubscribeUrl}\nEmail settings: ${o.settingsUrl}\nTriton Gaming · Gaming Org at UC San Diego\n${siteUrl().replace(/^https?:\/\//, '')}\n`,
  ].filter((x) => x !== '').join('\n');
}
