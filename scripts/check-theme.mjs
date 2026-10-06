// Portal styles must use the theme tokens (--pp-ink, --pp-card, --pp-line, rgba(var(--pp-ink-rgb), x) ...) so they follow light and dark.
// This lists literal colours that only work in one theme. A line that is deliberately fixed (white text on a coloured button, a QR ground)
// carries a "theme-ok" comment. Run: npm run check:theme
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src/app/(portal)', 'src/components/portal', 'src/components/ui'];
const BAD = [
  [/(?<![-\w])(?:color|fill|stroke|caret-color|border(?:-[a-z]+)*-color|outline-color):\s*(?:#fff\b|#ffffff\b|white\b|#f2f1f0\b|var\(--white\)|rgba\(\s*(?:255\s*,\s*255\s*,\s*255|242\s*,\s*241\s*,\s*240)\s*,)/i, 'light text/line colour'],
  [/(?<![-\w])(?:background(?:-color)?|border(?:-[a-z]+)?):[^;{}]*rgba\(\s*(?:255\s*,\s*255\s*,\s*255|242\s*,\s*241\s*,\s*240)\s*,/i, 'light translucent surface'],
  [/(?<![-\w])color:\s*(?:#000\b|#000000\b|black\b|#011941\b|var\(--navy[a-z-]*\)|var\(--black\))/i, 'dark text colour'],
  [/(?<![-\w])background(?:-color)?:\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/i, 'black overlay (muddy on light)'],
  [/(?<![-\w])background(?:-color)?:\s*(?:#000\b|#000000\b|black\b|#011941\b|#0b1020\b|var\(--navy[a-z-]*\))/i, 'dark surface'],
];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.css')) yield p;
  }
}

let count = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/theme-ok/.test(line)) return;
      for (const [re, why] of BAD) if (re.test(line)) { count++; console.log(`${file}:${i + 1}  ${why}\n    ${line.trim().slice(0, 150)}`); break; }
    });
  }
}
console.log(count ? `\n${count} line${count === 1 ? '' : 's'} use a colour that only works in one theme.` : 'Theme check passed.');
process.exit(count ? 1 : 0);
