'use client';

import { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';

export function smallIcon(icon: ReactNode, size = 21) {
  if (!isValidElement(icon)) return icon;
  return cloneElement(icon as ReactElement<{ size?: number; strokeWidth?: number }>, { size, strokeWidth: 1.75 });
}
