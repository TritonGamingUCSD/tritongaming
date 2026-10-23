import { PACIFIC_TZ } from '@/lib/core/timezone';
import { blocks, button, CREAM, esc, HEAD, BODY, LOGO_CID, MUTED, NAVY, SKY, siteUrl, YELLOW } from './template';
import type { EmailKind } from './prefs';

// The email for one event, in the club's look (see template.ts) with the event on show: its cover image, a paper-ticket block with the date, time and place, an optional note from the person
// sending, a yellow "Show my ticket" button, and a footer that says why the person got it and how to stop it. Email clients only trust old HTML (tables, inline styles), so the date block's
// hard shadow is a thicker bottom and right border, as in the standard template.

export interface EventForEmail { title: string; start_date: string; end_date?: string | null; location: string | null; is_online: boolean; cover_url: string | null; slug?: string | null }
export interface EventEmailOptions {
  event: EventForEmail; kind: EmailKind; subject: string; note: string;
  ticketUrl: string; unsubscribeUrl: string; settingsUrl: string; logoSrc?: string; test?: boolean;
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

export const eventEmailSubject = (kind: EmailKind, title: string) => (kind === 'reminders' ? `${title} is coming up` : kind === 'updates' ? `An update about ${title}` : title);

export function eventEmailHtml(o: EventEmailOptions): string {
  const { event: e } = o;
  const when = eventWhen(e);
  const place = e.is_online ? 'Online' : e.location || '';
  const site = siteUrl();
  const logo = o.logoSrc ?? `cid:${LOGO_CID}`;
  const cover = e.cover_url && /^https:\/\/[^\s"'<>]+$/i.test(e.cover_url)
    ? `<tr><td style="background:#ffffff;border-left:2px solid ${NAVY};border-right:6px solid ${NAVY};padding:0;font-size:0;line-height:0;"><img src="${esc(e.cover_url)}" width="600" alt="${esc(e.title)}" style="display:block;width:100%;height:auto;border:0;"></td></tr>`
    : '';
  const pre = `${e.title} · ${when.day} ${when.date}, ${when.time}${place ? ` · ${place}` : ''}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.subject)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${esc(pre.slice(0, 110))}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    ${o.test ? `<tr><td style="background:${YELLOW};color:${NAVY};font-family:${HEAD};font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;text-align:center;padding:6px;">Test email: nobody else got this</td></tr>` : ''}
    <tr><td style="background:${NAVY};border-radius:10px 10px 0 0;padding:20px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:14px;"><img src="${esc(logo)}" width="48" height="48" alt="TG" style="display:block;border:0;border-radius:10px;"></td>
        <td style="font-family:${HEAD};color:${CREAM};font-size:13px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;line-height:1.35;">Triton Gaming<br><span style="color:${YELLOW};letter-spacing:0.16em;font-size:11px;">Gaming Org at UC San Diego</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="height:6px;background:${YELLOW};font-size:0;line-height:0;">&nbsp;</td></tr>
    ${cover}
    <tr><td style="background:#ffffff;border:2px solid ${NAVY};border-top:0;border-bottom-width:6px;border-right-width:6px;padding:26px 26px 14px;font-family:${BODY};font-size:16px;line-height:1.6;color:${NAVY};">
      <span style="display:inline-block;background:${YELLOW};border:2px solid ${NAVY};font-family:${HEAD};font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;padding:3px 10px;">${esc(KIND_LABEL[o.kind])}</span>
      <h1 style="margin:14px 0 16px;font-family:${HEAD};font-size:26px;line-height:1.2;font-weight:800;color:${NAVY};">${esc(e.title)}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border:2px solid ${NAVY};border-bottom-width:5px;border-right-width:5px;background:${CREAM};"><tr>
        <td width="96" align="center" style="padding:14px 10px;border-right:2px dashed ${NAVY};font-family:${HEAD};">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.18em;color:${MUTED};">${esc(when.day)}</div>
          <div style="font-size:22px;font-weight:800;line-height:1.15;color:${NAVY};">${esc(when.date)}</div>
        </td>
        <td style="padding:14px 16px;font-family:${BODY};font-size:15px;line-height:1.5;color:${NAVY};">
          <b>${esc(when.time)}</b> (Pacific)${place ? `<br>${esc(place)}` : ''}
        </td>
      </tr></table>
      ${o.note.trim() ? blocks(o.note) : ''}
      ${button('Show my ticket', o.ticketUrl)}
    </td></tr>
    <tr><td style="padding:18px 6px 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
      You are getting this because you have a ticket to ${esc(e.title)}.<br>
      <a href="${esc(o.unsubscribeUrl)}" style="color:${SKY};text-decoration:underline;">Stop ${esc(KIND_WHY[o.kind])} emails</a> · <a href="${esc(o.settingsUrl)}" style="color:${SKY};text-decoration:underline;">Email settings</a><br>
      <a href="${esc(site)}" style="color:${SKY};text-decoration:underline;">${esc(site.replace(/^https?:\/\//, ''))}</a> · Sent by the Triton Gaming team.
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
    `\nShow my ticket: ${o.ticketUrl}`,
    `\n—\nYou are getting this because you have a ticket to ${o.event.title}.\nStop ${KIND_WHY[o.kind]} emails: ${o.unsubscribeUrl}\nEmail settings: ${o.settingsUrl}\nTriton Gaming · Gaming Org at UC San Diego\n${siteUrl().replace(/^https?:\/\//, '')}\n`,
  ].filter((x) => x !== '').join('\n');
}
