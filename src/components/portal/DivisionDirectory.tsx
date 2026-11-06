'use client';

import { createContext, useContext } from 'react';

export interface DirDivision {
  id: string;
  name: string;
  slug: string;
  accent: string;
}
const Ctx = createContext<DirDivision[]>([]);

/** Every division's id, name, address and accent colour, so a list can name and colour an item's owner from its division id alone. */
export function DivisionDirectoryProvider({ value, children }: { value: DirDivision[]; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useDivisionDirectory = () => useContext(Ctx);
