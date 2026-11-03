// Public sign-ups for the Newspaper (people without an account). Pure checks shared by the sign-up route and its tests.

export const MAX_PENDING_PER_HOUR = 60; // new unconfirmed sign-ups the whole site accepts in an hour (a flood of someone else's addresses is turned away)
export const RESEND_AFTER_MS = 10 * 60_000; // a person who signs up again before this gets no second confirm email

/** An email address as people type it: trimmed, lower case, one plausible address (the confirm email proves it is real). */
export function cleanEmail(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s.length <= 254 && /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[a-z]{2,}$/i.test(s) ? s : '';
}

export const cleanName = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : '');
