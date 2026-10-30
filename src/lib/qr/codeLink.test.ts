import { describe, expect, it } from 'vitest';
import { codeFromLink, codeLink } from './codeLink';

describe('code links', () => {
  const payload = 't00ffeeddccbb';
  it('a code becomes a link on the site and comes back out of it', () => {
    expect(codeLink(payload, 'https://tritongaming.org')).toBe('https://tritongaming.org/portal/code/t00ffeeddccbb');
    expect(codeLink(payload, 'https://tritongaming.org/')).toBe('https://tritongaming.org/portal/code/t00ffeeddccbb');
    expect(codeFromLink(codeLink(payload, 'https://tritongaming.org'))).toBe(payload);
    expect(codeFromLink('https://www.tritongaming.org/portal/code/m0123456789ab/')).toBe('m0123456789ab');
  });
  it('the page the code is open on counts as this site (a preview or local address)', () => {
    expect(codeFromLink('http://localhost:3000/portal/code/rabcdefabcdef')).toBeNull();
    expect(codeFromLink('http://localhost:3000/portal/code/rabcdefabcdef', 'http://localhost:3000')).toBe('rabcdefabcdef');
  });
  it('refuses another site, another kind, a wrong length, uppercase or anything added', () => {
    for (const bad of [
      'https://example.com/portal/code/t00ffeeddccbb',
      'https://tritongaming.org/portal/code/x00ffeeddccbb',
      'https://tritongaming.org/portal/code/t00ffeedd',
      'https://tritongaming.org/portal/code/T00FFEEDDCCBB',
      'https://tritongaming.org/portal/code/t00ffeeddccbb?next=1',
      'https://tritongaming.org/portal/code/t00ffeeddccbb#x',
      'https://tritongaming.org.evil.com/portal/code/t00ffeeddccbb',
      'tg:t00ffeedd',
      'not a link',
    ])
      expect(codeFromLink(bad)).toBeNull();
  });
});
