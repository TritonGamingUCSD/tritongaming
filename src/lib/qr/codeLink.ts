// The QR code option for the portal's own codes (a ticket, a meeting's check-in, a reward pickup): a standard QR code holding a link to a page of the portal that handles that code, so a phone's
// ordinary camera opens the page, and the portal's Scan button recognises the link and handles the code in place, exactly as it does a TGcode or a Bytecode.
//   https://tritongaming.org/portal/code/<kind><12 hex digits of key>      (kind: m meeting, t ticket, r reward)
export const CODE_PATH = '/portal/code/';
const CODE_LINK = new RegExp(`^${CODE_PATH}([mtr][0-9a-f]{12})/?$`);

/** The link a code is drawn as. */
export const codeLink = (payload: string, origin: string): string => `${origin.replace(/\/$/, '')}${CODE_PATH}${payload}`;

/** The code a QR's text carries (`m…`, `t…` or `r…` and 12 hex digits) when the text is a code link of this site (tritongaming.org, its subdomains, or `origin` where the page is open), else null. */
export function codeFromLink(text: string, origin?: string): string | null {
  try {
    const u = new URL(text.trim());
    const ours = /(^|\.)tritongaming\.org$/i.test(u.hostname) || (!!origin && u.origin === origin);
    if (!ours || u.search || u.hash) return null;
    return u.pathname.match(CODE_LINK)?.[1] ?? null;
  } catch {
    return null;
  }
}
