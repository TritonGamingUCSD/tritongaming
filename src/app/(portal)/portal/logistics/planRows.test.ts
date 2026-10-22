import { describe, expect, it } from 'vitest';
import { primaryRank } from './planRows';

describe('primaryRank', () => {
  it('ranks the main device of a set above its parts', () => {
    for (const t of ['Gaming PC', 'Non-Gaming PC', 'Gaming Laptop', 'Nintendo Switch']) expect(primaryRank(t)).toBeLessThan(99);
    for (const t of ['Keyboard', 'Monitor', 'Nintendo Switch Dock', 'Switch Pro Controller', 'Ethernet Switch', 'Nintendo Switch - Left Joycon']) expect(primaryRank(t)).toBe(99);
  });
  it('puts a PC before a laptop before a console', () => {
    expect(primaryRank('Gaming PC')).toBeLessThan(primaryRank('Gaming Laptop'));
    expect(primaryRank('Gaming Laptop')).toBeLessThan(primaryRank('Nintendo Switch'));
  });
});
