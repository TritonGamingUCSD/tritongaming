import { describe, expect, it } from 'vitest';
import { emailHtml, emailText } from './template';

const html = (message: string, subject = 'Hi') => emailHtml({ subject, message });

describe('email template', () => {
  it('escapes HTML in the subject and message', () => {
    const h = html('<script>alert(1)</script> & "quotes"', '<b>Hi</b>');
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('&lt;b&gt;Hi&lt;/b&gt;');
  });
  it('makes paragraphs, line breaks and bullet lists', () => {
    const h = html('One\ntwo\n\n- a\n- b');
    expect(h).toContain('One<br>two');
    expect(h).toMatch(/<ul[^>]*><li[^>]*>a<\/li><li[^>]*>b<\/li><\/ul>/);
  });
  it('links web addresses and [text](url), and turns a lone link into a button', () => {
    expect(html('See https://tritongaming.org/portal.')).toContain('<a href="https://tritongaming.org/portal"');
    expect(html('Read [the doc](https://x.org/d) now')).toContain('<a href="https://x.org/d"');
    expect(html('[Open the portal](https://tritongaming.org/portal)')).toContain('text-transform:uppercase');
  });
  it('never makes a link from javascript: or other schemes', () => {
    const h = html('[click](javascript:alert(1)) and [x](data:text/html,hi)');
    expect(h).not.toContain('href="javascript');
    expect(h).not.toContain('href="data');
  });
  it('has the logo by cid when sent, and a plain-text version with the footer', () => {
    expect(html('x')).toContain('src="cid:tglogo"');
    expect(emailText('Hello')).toMatch(/Hello\n\n—\nTriton Gaming · Gaming Org at UC San Diego/);
  });
});
