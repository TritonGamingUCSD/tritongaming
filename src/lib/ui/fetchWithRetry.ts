// A dropped request on spotty wifi and a real rejection from the server are
// different problems — this only retries the first kind. A 4xx is the
// server telling you something's actually wrong with the request (bad code,
// unauthorized, etc.); retrying that just repeats the same failure. A
// network failure (fetch throws) or a 5xx (server-side hiccup) is exactly
// the kind of thing a flaky connection produces, so those get a couple of
// quick retries with a short backoff before giving up.
// `timeoutMs`: one try that has not answered by then is given up (and counts as a failed try), so a connection that stalls never leaves the screen waiting for ever.
export async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = 3, timeoutMs?: number): Promise<Response> {
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, timeoutMs ? { ...init, signal: AbortSignal.timeout(timeoutMs) } : init);
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastResponse = res;
      lastError = new Error(`Request failed with status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(3, i)));
    }
  }
  // A real (if unsuccessful) 5xx response is more useful to the caller than
  // a generic thrown error — they can still read its status/body — so
  // return it rather than throwing when every retry at least got a response.
  if (lastResponse) return lastResponse;
  throw lastError;
}
