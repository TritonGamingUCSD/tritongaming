import { describe, expect, it } from 'vitest';
import { eventEmailHtml, eventEmailSubject, eventEmailText, eventWhen, type EventEmailOptions } from './eventEmail';
import { EMAIL_KINDS, isEmailKind, wantsEmail } from './prefs';

const base: EventEmailOptions = {
  event: { title: 'Division <Showcase>', start_date: '2026-10-24T22:00:00Z', end_date: '2026-10-25T03:00:00Z', location: 'Price Center', is_online: false, cover_url: 'https://example.org/c.png' },
  kind: 'reminders', subject: 'Coming up', note: 'Park in lot 7.\n\nBring your ID.', ticketUrl: 'https://tritongaming.org/portal/tickets?qr=1', unsubscribeUrl: 'https://tritongaming.org/api/email/unsubscribe?t=x', settingsUrl: 'https://tritongaming.org/portal/profile',
};

describe('event email', () => {
  it('shows the event in Pacific time with its place, note, ticket button and opt-out link, all escaped', () => {
    const h = eventEmailHtml(base);
    expect(h).toContain('Division &lt;Showcase&gt;');
    expect(h).not.toContain('<Showcase>');
    expect(h).toContain('3:00 PM');
    expect(h).toContain('Price Center');
    expect(h).toContain('Park in lot 7.');
    expect(h).toContain('Show my ticket');
    expect(h).toContain('href="https://tritongaming.org/portal/tickets?qr=1"');
    expect(h).toContain('Stop event reminders emails');
    expect(h).toContain('href="https://tritongaming.org/api/email/unsubscribe?t=x"');
    expect(h).toContain('src="https://example.org/c.png"');
  });
  it('leaves out the cover when it is not an https address, and says Online for an online event', () => {
    expect(eventEmailHtml({ ...base, event: { ...base.event, cover_url: 'javascript:alert(1)' } })).not.toContain('javascript');
    expect(eventEmailHtml({ ...base, event: { ...base.event, is_online: true, location: null } })).toContain('Online');
  });
  it('marks a test, and has a plain-text version with the same links', () => {
    expect(eventEmailHtml({ ...base, test: true })).toContain('Test email');
    const t = eventEmailText(base);
    expect(t).toContain('Show my ticket: https://tritongaming.org/portal/tickets?qr=1');
    expect(t).toContain('Stop event reminders emails: https://tritongaming.org/api/email/unsubscribe?t=x');
  });
  it('writes the date block and the default subjects', () => {
    expect(eventWhen(base.event)).toEqual({ day: 'SAT', date: 'Oct 24', time: '3:00 PM – 8:00 PM' });
    expect(eventEmailSubject('reminders', 'Expo')).toBe('Expo is coming up');
    expect(eventEmailSubject('updates', 'Expo')).toBe('An update about Expo');
  });
});

describe('email preferences', () => {
  it('is on until switched off, and the master switch beats the kinds', () => {
    expect(wantsEmail(null, 'reminders')).toBe(true);
    expect(wantsEmail({ email_reminders: false }, 'reminders')).toBe(false);
    expect(wantsEmail({ email_reminders: false }, 'updates')).toBe(true);
    expect(wantsEmail({ email_all: false }, 'newsletter')).toBe(false);
    expect(wantsEmail({ email_all: true, email_notifications: false }, 'updates')).toBe(false);
  });
  it('knows its kinds', () => {
    expect(EMAIL_KINDS.map((k) => k.id)).toEqual(['reminders', 'updates', 'newsletter']);
    expect(isEmailKind('updates')).toBe(true);
    expect(isEmailKind('spam')).toBe(false);
  });
});
