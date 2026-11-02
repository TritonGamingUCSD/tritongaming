'use client';

import { useState } from 'react';

/** True once `value` differs from what it was when the form first drew (compared by JSON, so typing something and putting it back is not a change). For a dialog's `dirty` prop. */
export function useDirty(value: unknown): boolean {
  const [first] = useState(() => JSON.stringify(value));
  return JSON.stringify(value) !== first;
}
