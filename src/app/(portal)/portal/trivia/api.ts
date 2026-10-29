// One way to call the Trivia routes: the answer, or a sentence to show.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function call<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as T } : { ok: false, error: (json as { error?: string }).error ?? 'Something went wrong. Try again.', status: res.status };
  } catch {
    return { ok: false, error: 'Couldn’t reach the server. Check your connection.', status: 0 };
  }
}

// A question's picture goes up as a small WebP file (see compressImage.ts), as form data rather than JSON.
export async function uploadPicture(slug: string, question: string, blob: Blob): Promise<Result<{ image: string }>> {
  try {
    const form = new FormData();
    form.append('question', question);
    form.append('file', new File([blob], 'picture.webp', { type: 'image/webp' }));
    const res = await fetch(`/api/trivia/quizzes/${slug}/image`, { method: 'POST', body: form, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json as { image: string } } : { ok: false, error: (json as { error?: string }).error ?? 'Couldn’t save the picture.', status: res.status };
  } catch {
    return { ok: false, error: 'Couldn’t reach the server. Check your connection.', status: 0 };
  }
}
