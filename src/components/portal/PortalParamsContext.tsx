'use client';

import { createContext, useContext, type ReactNode } from 'react';

// The portal address as the SERVER saw it (path segments already folded into section/tab/subtab). The client uses it while it hydrates, so the
// first client render matches the server's HTML; after that the live address bar is the source of truth (see useLiveParams).
const Ctx = createContext<string | null>(null);

export function PortalParamsProvider({ query, children }: { query: string; children: ReactNode }) {
  return <Ctx.Provider value={query}>{children}</Ctx.Provider>;
}
export const useServerPortalQuery = () => useContext(Ctx);
