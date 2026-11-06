import { describe, expect, it } from 'vitest';
import { cleanLinks, normalizeUrl, providerOf, startggEventSlug } from '../external';

describe('external links', () => {
  it('recognises the sites by address', () => {
    expect(providerOf('https://www.start.gg/tournament/x/event/y')).toBe('startgg');
    expect(providerOf('https://liquipedia.net/valorant/Champions')).toBe('liquipedia');
    expect(providerOf('https://www.vlr.gg/event/1')).toBe('vlr');
    expect(providerOf('https://example.org/a')).toBe('other');
  });
  it('accepts a bare address and refuses anything that is not a web address', () => {
    expect(normalizeUrl('start.gg/tournament/x')).toBe('https://start.gg/tournament/x');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('nonsense')).toBeNull();
  });
  it('cleans a list: no duplicates, labels trimmed, provider filled in', () => {
    const l = cleanLinks([{ url: 'vlr.gg/event/1', label: 'Results' }, { url: 'https://vlr.gg/event/1' }, { url: 'bad' }]);
    expect(l).toEqual([{ provider: 'vlr', url: 'https://vlr.gg/event/1', label: 'Results' }]);
  });
  it('reads the event slug out of a start.gg link', () => {
    expect(startggEventSlug('https://www.start.gg/tournament/fall-smash-12/event/melee-singles/overview')).toBe('tournament/fall-smash-12/event/melee-singles');
    expect(startggEventSlug('https://www.start.gg/tournament/fall-smash-12')).toBeNull();
    expect(startggEventSlug('https://liquipedia.net/x')).toBeNull();
  });
});
