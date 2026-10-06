'use client';

import { createContext, useContext, type ReactNode } from 'react';

// Who is using the portal, for "who else is editing this". `track` is off while an admin views the portal as someone else (view only), so the viewed person is never shown as editing.
interface Identity { id: string; name: string; track: boolean }
const Ctx = createContext<Identity | null>(null);

export function PortalIdentityProvider({ id, name, track, children }: Identity & { children: ReactNode }) {
  return <Ctx.Provider value={{ id, name, track }}>{children}</Ctx.Provider>;
}
export const usePortalIdentity = () => useContext(Ctx);
