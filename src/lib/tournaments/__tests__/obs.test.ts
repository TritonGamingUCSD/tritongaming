import { describe, expect, it } from 'vitest';
import { obsSceneCollection, overlaySources } from '../obs';

const urls = {
  bracket: 'https://x/overlay/t/bracket?token=a',
  scoreboard: 'https://x/overlay/t/scoreboard?token=a',
  next: 'https://x/overlay/t/next?token=a',
  standings: 'https://x/overlay/t/standings?token=a',
  champion: 'https://x/overlay/t/champion?token=a',
};

describe('OBS scene collection', () => {
  const c = obsSceneCollection('Fall Smash', urls);
  it('has a browser source per overlay with its address and size', () => {
    const b = c.sources.filter((s) => s.id === 'browser_source');
    expect(b).toHaveLength(overlaySources(urls).length);
    expect(b[0].settings).toMatchObject({ url: urls.bracket, width: 1920, height: 1080 });
  });
  it('has scenes whose items point at real sources', () => {
    const ids = new Set(c.sources.map((s) => s.uuid));
    for (const s of c.sources.filter((x) => x.id === 'scene')) {
      const items = (s.settings as { items: { source_uuid: string }[] }).items;
      expect(items.length).toBeGreaterThan(0);
      for (const it of items) expect(ids.has(it.source_uuid)).toBe(true);
    }
    expect(c.scene_order.map((x) => x.name)).toContain(c.current_scene);
  });
  it('is plain JSON', () => {
    expect(() => JSON.parse(JSON.stringify(c))).not.toThrow();
  });
});
