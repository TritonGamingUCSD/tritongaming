import { describe, expect, test } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { mergedPortalParams, parsePortalPath, portalHref } from '../portalPath';
import { RESERVED_PORTAL_WORDS, isReservedPortalWord } from '../sections';

describe('portal addresses', () => {
  test('a division address reads as the Division section with its page', () => {
    expect(parsePortalPath('/portal/triton-league-tft')).toEqual({ section: 'division', tab: 'triton-league-tft', subtab: undefined, detail: undefined });
    expect(parsePortalPath('/portal/triton-league-tft/members')).toEqual({ section: 'division', tab: 'triton-league-tft', subtab: 'members', detail: undefined });
    const params = mergedPortalParams('/portal/tio/events', '');
    expect(params.get('section')).toBe('division');
    expect(params.get('tab')).toBe('tio');
    expect(params.get('subtab')).toBe('events');
  });

  test('sections and the portal’s own pages are never read as a division', () => {
    expect(parsePortalPath('/portal/events/analytics')?.section).toBe('events');
    expect(parsePortalPath('/portal/scan')).toBeNull();
    expect(parsePortalPath('/portal/code/abc')).toBeNull();
    expect(parsePortalPath('/portal/in/xyz')).toBeNull();
    expect(parsePortalPath('/portal')).toBeNull();
  });

  test('the address of a division is built from its params', () => {
    expect(portalHref(new URLSearchParams({ section: 'division', tab: 'tio' }))).toBe('/portal/tio');
    expect(portalHref(new URLSearchParams({ section: 'division', tab: 'tio', subtab: 'members' }))).toBe('/portal/tio/members');
    expect(portalHref(new URLSearchParams({ section: 'docs', tab: 'read' }))).toBe('/portal/docs/read');
  });

  test('every folder of the portal is a reserved word, so a division can never take its address', () => {
    const root = join(process.cwd(), 'src/app/(portal)/portal');
    const folders = readdirSync(root).filter((f) => statSync(join(root, f)).isDirectory());
    const missing = folders.filter((f) => !isReservedPortalWord(f));
    expect(missing, `add these to RESERVED_PORTAL_WORDS in lib/portal/sections.ts: ${missing.join(', ')}`).toEqual([]);
    expect(RESERVED_PORTAL_WORDS.length).toBeGreaterThan(30);
  });
});
