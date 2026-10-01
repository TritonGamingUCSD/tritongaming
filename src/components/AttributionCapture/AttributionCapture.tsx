'use client';

import { useEffect } from 'react';
import { captureAttribution } from '@/lib/attribution';

// Renders nothing; just notes how the visitor arrived (see lib/attribution).
export default function AttributionCapture() {
  useEffect(() => { captureAttribution(); }, []);
  return null;
}
