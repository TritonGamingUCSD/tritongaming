// Writes what can be made from the code's own definitions into the docs, so the docs cannot drift from the code: today the table of portal sections (src/lib/portal/sections.ts) in docs/code-map.md.
// Run: npm run docs:sync   (a test, src/lib/__tests__/sections.test.ts, fails when the docs are out of date). Node reads the TypeScript file directly (it has plain data and no imports).
import fs from 'node:fs';
import { DOC_END, DOC_START, sectionsDoc } from '../src/lib/portal/sections.ts';

const file = new URL('../docs/code-map.md', import.meta.url);
const text = fs.readFileSync(file, 'utf8');
const block = `${DOC_START}\n${sectionsDoc()}\n${DOC_END}`;
const a = text.indexOf(DOC_START), b = text.indexOf(DOC_END);
if (a === -1 || b === -1) throw new Error('docs/code-map.md has no sections block: add the DOC_START and DOC_END lines where the table should go.');
const next = text.slice(0, a) + block + text.slice(b + DOC_END.length);
if (next === text) console.log('docs/code-map.md is up to date.');
else { fs.writeFileSync(file, next); console.log('docs/code-map.md updated.'); }
