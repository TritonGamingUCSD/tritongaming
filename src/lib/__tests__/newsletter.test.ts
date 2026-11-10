import { describe, expect, test } from 'vitest';
import { cleanBlocks, linkOrEmpty, problemsIn, newBlock, MAX_BLOCKS } from '@/lib/newsletter/blocks';
import { cleanRules, rulesEmpty, NO_AUDIENCE } from '@/lib/newsletter/rules';
import { renderIssue } from '@/lib/newsletter/render';

const issue = { number: 7, title: 'Spring <News>', type: 'newsletter' as const };

describe('checking blocks from a browser', () => {
  test('keeps known types and fields, drops the rest', () => {
    const out = cleanBlocks([{ type: 'text', text: ' hi ', evil: 1 }, { type: 'script', text: 'x' }, null, { type: 'divider' }]);
    expect(out.map((b) => b.type)).toEqual(['text', 'divider']);
    expect(out[0]).toMatchObject({ text: 'hi' });
    expect(out[0]).not.toHaveProperty('evil');
  });
  test('links are http(s) or mailto only; pictures are https only', () => {
    expect(linkOrEmpty('https://a.org/x')).toBe('https://a.org/x');
    expect(linkOrEmpty('javascript:alert(1)')).toBe('');
    expect(linkOrEmpty('https://a.org/"onclick=')).toBe('');
    expect(cleanBlocks([{ type: 'image', url: 'http://a.org/x.png', alt: 'a' }])[0]).toMatchObject({ url: '' });
    expect(cleanBlocks([{ type: 'button', label: 'Go', url: 'data:text/html,x' }])[0]).toMatchObject({ url: '' });
  });
  test('cuts to length and to the most blocks', () => {
    expect((cleanBlocks([{ type: 'heading', text: 'x'.repeat(500) }])[0] as { text: string }).text.length).toBe(160);
    expect(cleanBlocks(Array.from({ length: 200 }, () => ({ type: 'divider' }))).length).toBe(MAX_BLOCKS);
  });
  test('every block type can be made and survives cleaning', () => {
    for (const t of ['heading', 'text', 'button', 'image', 'event', 'columns', 'quote', 'card', 'people', 'divider', 'spacer'] as const) {
      expect(cleanBlocks([newBlock(t)])[0]?.type).toBe(t);
    }
  });
  test('says what is missing in words', () => {
    expect(problemsIn('', [])).toHaveLength(2);
    expect(problemsIn('T', cleanBlocks([{ type: 'button', label: 'Go', url: '' }]))[0]).toMatch(/needs a label and a link/);
    expect(problemsIn('T', cleanBlocks([{ type: 'image', url: 'https://a.org/x.png', alt: '' }]))[0]).toMatch(/description/);
    expect(problemsIn('T', cleanBlocks([{ type: 'text', text: 'hello' }]))).toEqual([]);
  });
});

describe('audience rules', () => {
  test('keeps only known roles and well-formed ids', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const r = cleanRules({
      roles: ['exec', 'god'],
      people: [id, 'nope'],
      exclude: [id],
      divisions: ['x'],
      events: [{ id, who: 'checkedin' }, { id: 'bad' }],
      subscribers: 1,
      everyone: true,
    });
    expect(r.roles).toEqual(['exec']);
    expect(r.people).toEqual([id]);
    expect(r.divisions).toEqual([]);
    expect(r.events).toEqual([{ id, who: 'checkedin' }]);
    expect(r.subscribers).toBe(false); // only a real true counts
    expect(r.everyone).toBe(true);
  });
  test('nothing picked is empty', () => {
    expect(rulesEmpty(NO_AUDIENCE)).toBe(true);
    expect(rulesEmpty({ ...NO_AUDIENCE, subscribers: true })).toBe(false);
    expect(rulesEmpty(cleanRules(undefined))).toBe(true);
  });
});

describe('rendering an issue', () => {
  const blocks = cleanBlocks([
    { type: 'heading', text: 'Hello <b>', size: 'large' },
    { type: 'text', text: 'See [the site](https://tritongaming.org/a?x=1&y=2) now' },
    { type: 'button', label: 'Join', url: 'https://tritongaming.org/join' },
  ]);
  test('escapes what people typed, in the page and the title', () => {
    const { html } = renderIssue({ issue, blocks, events: new Map() });
    expect(html).toContain('Hello &lt;b&gt;');
    expect(html).toContain('Spring &lt;News&gt;');
    expect(html).not.toContain('<b>');
  });
  test('the click counter rewrites the body’s links but not the footer’s', () => {
    const seen: string[] = [];
    const { html } = renderIssue({
      issue,
      blocks,
      events: new Map(),
      webUrl: 'https://tritongaming.org/newsletter/abc',
      unsubscribeUrl: 'https://tritongaming.org/api/email/unsubscribe?t=1',
      link: (u) => (seen.push(u), `https://t.example/c/${seen.length}`),
    });
    expect(seen).toEqual(['https://tritongaming.org/a?x=1&y=2', 'https://tritongaming.org/join']);
    expect(html).toContain('href="https://t.example/c/1"');
    expect(html).toContain('href="https://tritongaming.org/newsletter/abc"');
    expect(html).toContain('/api/email/unsubscribe?t=1');
  });
  test('a plain-text version is made too, and a test copy says so', () => {
    const r = renderIssue({ issue, blocks, events: new Map(), test: true });
    expect(r.text).toContain('HELLO <B>');
    expect(r.text).toContain('Join: https://tritongaming.org/join');
    expect(r.html).toContain('Test copy');
  });
  test('an event card for an event that is gone is left out instead of breaking the email', () => {
    const { html } = renderIssue({ issue, blocks: cleanBlocks([{ type: 'event', event_id: '123e4567-e89b-12d3-a456-426614174000' }]), events: new Map() });
    expect(html).toContain('<h1');
  });
});

describe('text formatting in emails', () => {
  const html = (text: string) => renderIssue({ issue, blocks: [{ id: 'a1b2', type: 'text', text }], events: new Map() }).html;
  const plain = (text: string) => renderIssue({ issue, blocks: [{ id: 'a1b2', type: 'text', text }], events: new Map() }).text;
  test('**bold** and *italic* become tags, not stars', () => {
    const h = html('This is **bold**, this is *italic* and _also italic_.');
    expect(h).toContain('<strong>bold</strong>');
    expect(h).toContain('<em>italic</em>');
    expect(h).toContain('<em>also italic</em>');
    expect(h).not.toContain('**');
  });
  test('snake_case words, maths and single stars are left alone', () => {
    const h = html('Use my_file_name and 2*3*4 and a lone * star.');
    expect(h).toContain('my_file_name');
    expect(h).toContain('2*3*4');
    expect(h).not.toContain('<em>');
  });
  test('web addresses with underscores stay whole, and bold works inside link words', () => {
    const h = html('See https://a.org/x_y_z now and [**read** more](https://a.org/b)');
    expect(h).toContain('href="https://a.org/x_y_z"');
    expect(h).toContain('<strong>read</strong> more</a>');
  });
  test('numbered lists, bullet lists and headings can follow each other without a blank line', () => {
    const h = html('Intro line\n- one\n- two\n1. first\n2. second\n## A heading\nAfter');
    expect(h).toContain('<ul');
    expect(h).toContain('<ol');
    expect(h).toContain('<h3');
    expect(h.match(/<li /g)?.length).toBe(4);
    expect(h).toContain('Intro line</p>');
    expect(h).toContain('After</p>');
  });
  test('markup typed by a writer is still escaped', () => {
    const h = html('**<script>alert(1)</script>** and <img src=x onerror=alert(1)>');
    expect(h).not.toContain('<script>');
    expect(h).not.toContain('<img src=x');
    expect(h).toContain('&lt;script&gt;');
  });
  test('text carries its own font so Outlook does not fall back to Times', () => {
    expect(html('Hello')).toMatch(/<p style="[^"]*font-family:[^"]*font-size:16px/);
    const cols = renderIssue({ issue, blocks: [{ id: 'c1c2', type: 'columns', left: 'L', right: 'R' }], events: new Map() }).html;
    expect(cols).toMatch(/<td class="tg-col"[\s\S]*<p style="[^"]*font-family/);
  });
  test('the plain-text version has no markdown marks', () => {
    const t = plain('**Bold** and [the site](https://a.org) and\n## Heading');
    expect(t).toContain('Bold and the site (https://a.org) and');
    expect(t).toContain('Heading');
    expect(t).not.toMatch(/\*\*|\]\(|##/);
  });
});
