import { describe, expect, it } from 'vitest';
import { EMAIL_KINDS, isEmailKind, wantsEmail } from './prefs';

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
