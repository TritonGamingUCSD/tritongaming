'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/portal/siteSettings';

// The site-wide settings (see lib/portal/siteSettings.ts), read once by the portal layout and handed to the pages below it.
const Ctx = createContext<SiteSettings>(DEFAULT_SETTINGS);
export const useSiteSettings = () => useContext(Ctx);
export default function SiteSettingsProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
