import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { safeFetch } from '@/lib/ui/safeFetch';

const reply = (status: number) => new Response('{}', { status });

describe('safeFetch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('a read that fails on the network is tried again and then works', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(reply(200));
    vi.stubGlobal('fetch', f);
    const p = safeFetch('/x');
    await vi.advanceTimersByTimeAsync(600);
    expect((await p).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });
  test('a replace (PUT) is tried again when the server says 503', async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(200));
    vi.stubGlobal('fetch', f);
    const p = safeFetch('/x', { method: 'PUT' });
    await vi.advanceTimersByTimeAsync(600);
    expect((await p).status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });
  test('it gives up after three tries and says so', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('offline'));
    vi.stubGlobal('fetch', f);
    const p = safeFetch('/x', { method: 'DELETE' }).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBeInstanceOf(TypeError);
    expect(f).toHaveBeenCalledTimes(3);
  });
  test('creating something (POST) and changing fields (PATCH) are sent only once', async () => {
    for (const method of ['POST', 'PATCH']) {
      const f = vi.fn().mockRejectedValue(new TypeError('offline'));
      vi.stubGlobal('fetch', f);
      await expect(safeFetch('/x', { method })).rejects.toBeInstanceOf(TypeError);
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  test('a 500 or a 409 is an answer, not a blip: no second try', async () => {
    for (const status of [409, 500]) {
      const f = vi.fn().mockResolvedValue(reply(status));
      vi.stubGlobal('fetch', f);
      expect((await safeFetch('/x', { method: 'PUT' })).status).toBe(status);
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
});
