import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Every source file is formatted by Prettier (.prettierrc.json). If this fails, run `npm run format` and commit the result.
describe('formatting', () => {
  it('every source file is formatted by Prettier', () => {
    const root = path.resolve(__dirname, '../../..');
    let out = '';
    try {
      execFileSync(path.join(root, 'node_modules/.bin/prettier'), ['--list-different', '.'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? e);
    }
    expect(out.trim().split('\n').filter(Boolean), 'these files are not formatted (run npm run format)').toEqual([]);
  }, 120_000);
});
