// A `fetch` that shrugs off a dropped connection: a request that can safely be sent twice (reading, replacing or deleting something) is tried again up to twice, after a short wait, when the network fails or the server answers
// 502, 503 or 504 (a venue's Wi-Fi blinking, a server waking up). Creating something (POST) and changing a few fields (PATCH) are sent once, because sending them twice could do it twice or answer "someone changed it" about the person's own change.
const SAFE = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);
const RETRY_STATUS = new Set([502, 503, 504]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function safeFetch(url: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  const again = SAFE.has((init.method ?? 'GET').toUpperCase());
  for (let i = 0; ; i++) {
    const last = !again || i >= tries - 1;
    try {
      const res = await fetch(url, init);
      if (!last && RETRY_STATUS.has(res.status)) {
        await wait(500 * 2 ** i);
        continue;
      }
      return res;
    } catch (e) {
      if (last) throw e;
      await wait(500 * 2 ** i);
    }
  }
}
