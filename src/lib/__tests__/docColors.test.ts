import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkDocColors } from '@/lib/docs/remarkDocColors';

const html = (md: string) => renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkDocColors] }, md));

describe('doc text colour and highlight', () => {
  it('turns a colour pair into one coloured span', () => {
    expect(html('Hello <span data-c="red">big red</span> world')).toContain('<span data-c="red">big red</span>');
  });
  it('keeps bold and links inside the colour', () => {
    const out = html('<span data-c="blue">a **bold** [link](https://x.org) b</span>');
    expect(out).toMatch(/<span data-c="blue">a <strong>bold<\/strong> <a [^>]*>link<\/a> b<\/span>/);
  });
  it('highlights with mark', () => {
    expect(html('<mark data-h="yellow">note</mark>')).toContain('<mark data-h="yellow">note</mark>');
  });
  it('ignores colours outside the palette and any other html', () => {
    expect(html('<span data-c="evil">x</span>')).not.toContain('<span');
    expect(html('<span style="color:red">x</span>')).not.toContain('<span');
    expect(html('<script>alert(1)</script>')).not.toContain('<script');
  });
});
