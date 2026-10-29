import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOC_END, DOC_START, MAIN_TABS, SECTIONS, SECTION_IDS, sectionsDoc } from '@/lib/portal/sections';
import { parsePortalPath } from '@/lib/portal/portalPath';
import { commandsFor } from '@/lib/portal/portalCommands';

// The portal's sections are defined once (lib/portal/sections.ts). These checks keep everything that reads the list honest, so adding a section in one place cannot leave another place behind.
const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('the sections list', () => {
  it('has no duplicate or malformed address words', () => {
    expect(new Set(SECTION_IDS).size).toBe(SECTION_IDS.length);
    for (const id of SECTION_IDS) expect(id).toMatch(/^[a-z][a-z-]*$/);
  });
  it('every section with a page has a block in the portal page, and every block is in the list', () => {
    const page = read('src/app/(portal)/portal/page.tsx');
    const inPage = [...page.matchAll(/id: '([a-z-]+)',\s*icon:/g)].map((m) => m[1]);
    for (const s of SECTIONS) if (!s.address) expect(inPage, `${s.id} is in the list but page.tsx has no block for it`).toContain(s.id);
    for (const id of inPage) expect(SECTION_IDS, `${id} has a block in page.tsx but is not in lib/portal/sections.ts`).toContain(id);
  });
  it('the addresses, the hub, the rewrites and the tab sync read the list instead of repeating it', () => {
    expect(read('next.config.ts')).toContain("from './src/lib/portal/sections'");
    expect(read('next.config.ts')).not.toMatch(/'tickets', 'points'/);
    expect(read('src/components/portal/PortalHub.tsx')).not.toMatch(/SECTION_ORDER = \[/);
    expect(read('src/components/portal/PortalHub.tsx')).not.toMatch(/SECTION_LABELS: Record/);
    expect(read('src/lib/portal/portalPath.ts')).not.toMatch(/'tickets', 'points'/);
    expect(read('src/lib/portal/usePortalTabSync.ts')).not.toMatch(/tickets: 'tickets', admin:/);
  });
  it('every address word opens as a portal address, and a first tab is a plain word', () => {
    for (const id of SECTION_IDS) expect(parsePortalPath(`/portal/${id}/x`)?.section).toBe(id);
    for (const [id, tab] of Object.entries(MAIN_TABS)) {
      expect(SECTION_IDS).toContain(id);
      expect(tab).toMatch(/^[a-z][a-z-]*$/);
    }
  });
  it('the search offers every section that has an entry, to someone allowed to open it', () => {
    const everything = ['admin', 'exec', 'lead', 'officer', 'recruit'].map((role) => ({ role, division_id: null }));
    const offered = commandsFor(everything as never).map((c) => c.href);
    for (const s of SECTIONS) if (s.search && !['points'].includes(s.id)) expect(offered, `${s.id} is missing from the search`).toContain(`/portal/${s.id}`);
  });
  it('the docs table is up to date (run npm run docs:sync)', () => {
    const docs = read('docs/code-map.md');
    const a = docs.indexOf(DOC_START),
      b = docs.indexOf(DOC_END);
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(docs.slice(a + DOC_START.length, b).trim()).toBe(sectionsDoc());
  });
});
