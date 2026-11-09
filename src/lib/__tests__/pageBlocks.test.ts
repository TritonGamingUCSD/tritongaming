import { describe, expect, it } from 'vitest';
import { cleanBlocks, cleanStyle, newBlock, videoEmbed, BLOCK_LIMITS, type BlockType } from '../site/pageBlocks';

describe('video links', () => {
  it('embeds YouTube, Twitch and Vimeo', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(videoEmbed('https://www.twitch.tv/tritongaming', 'tritongaming.org')).toBe('https://player.twitch.tv/?channel=tritongaming&parent=tritongaming.org&autoplay=false');
    expect(videoEmbed('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789');
  });
  it('refuses anything else', () => {
    for (const u of [
      'http://youtu.be/dQw4w9WgXcQ',
      'https://evil.example/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'not a url',
      'https://www.twitch.tv/a/b',
    ])
      expect(videoEmbed(u)).toBeNull();
  });
});

describe('block style', () => {
  it('keeps only known values', () => {
    expect(cleanStyle({ bg: 'navy', width: 'wide', align: 'center', space: 'lg', hide: 'phone', anchor: 'Our Rules!' })).toEqual({
      bg: 'navy',
      width: 'wide',
      align: 'center',
      space: 'lg',
      hide: 'phone',
      anchor: 'our-rules',
    });
    expect(cleanStyle({ bg: 'red', width: 'huge', hide: 'all', anchor: '###' })).toBeUndefined();
    expect(cleanStyle(null)).toBeUndefined();
  });
});

describe('cleaning blocks', () => {
  it('drops empty blocks and unknown types', () => {
    expect(cleanBlocks([{ type: 'text', markdown: '  ' }, { type: 'nope' }, null, 'x', { type: 'hero', title: '' }])).toEqual([]);
    expect(cleanBlocks('x')).toEqual([]);
  });
  it('keeps a valid block with its style', () => {
    const [b] = cleanBlocks([{ id: 'a1', type: 'text', markdown: 'Hi', style: { bg: 'ink', hide: 'phone' } }]);
    expect(b).toEqual({ id: 'a1', type: 'text', markdown: 'Hi', style: { bg: 'ink', hide: 'phone' } });
  });
  it('only lets https or this-site addresses through', () => {
    const [h] = cleanBlocks([{ type: 'hero', title: 'T', image: 'javascript:alert(1)', buttonLabel: 'Go', buttonUrl: '//evil.com' }]);
    expect(h).toMatchObject({ type: 'hero', image: '', buttonUrl: '' });
    const [b] = cleanBlocks([
      {
        type: 'buttons',
        items: [
          { label: 'A', url: 'https://ok.example/x' },
          { label: 'B', url: 'javascript:1' },
          { label: 'C', url: '/events', kind: 'secondary' },
          { label: 'D', url: '#rules' },
        ],
      },
    ]);
    expect(b).toMatchObject({
      items: [
        { label: 'A', kind: 'primary' },
        { label: 'C', url: '/events', kind: 'secondary' },
        { label: 'D', url: '#rules' },
      ],
    });
    expect((b as { items: unknown[] }).items).toHaveLength(3);
  });
  it('carousel and gallery photos need an address, a carousel photo needs a credit', () => {
    const [c] = cleanBlocks([
      {
        type: 'carousel',
        items: [
          { url: 'https://x.example/a.jpg', credit: 'Sam' },
          { url: 'https://x.example/b.jpg', credit: '' },
          { url: 'http://x.example/c.jpg', credit: 'Z' },
        ],
      },
    ]);
    expect((c as { items: unknown[] }).items).toHaveLength(1);
  });
  it('checks a countdown date and a video link', () => {
    expect(cleanBlocks([{ type: 'countdown', at: 'soon' }])).toEqual([]);
    expect(cleanBlocks([{ type: 'countdown', at: '2027-01-01T18:00:00Z', label: 'Doors open' }])).toHaveLength(1);
    expect(cleanBlocks([{ type: 'video', url: 'https://example.com/v' }])).toEqual([]);
    expect(cleanBlocks([{ type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' }])).toHaveLength(1);
  });
  it('caps counts', () => {
    const many = Array.from({ length: 80 }, () => ({ type: 'divider' }));
    expect(cleanBlocks(many)).toHaveLength(BLOCK_LIMITS.blocks);
    const [l] = cleanBlocks([{ type: 'logos', items: Array.from({ length: 40 }, (_, i) => ({ image: `https://x.example/${i}.png` })) }]);
    expect((l as { items: unknown[] }).items).toHaveLength(BLOCK_LIMITS.logos);
  });
  it('every new block type starts empty and is dropped until it has content', () => {
    const types: BlockType[] = ['text', 'highlights', 'faq', 'gallery', 'hero', 'imageText', 'columns', 'buttons', 'video', 'people', 'logos', 'countdown', 'carousel'];
    for (const t of types) expect(cleanBlocks([newBlock(t)])).toEqual([]);
    expect(cleanBlocks([newBlock('divider')])).toHaveLength(1);
  });
});
