'use client';

import type { DivisionHat } from '@/components/portal/hubTypes';
import QRStudioClient from '../qrcode/QRStudioClient';

// QR Studio inside a division: the same tool as the club's, but it starts as this division's (its logo in the middle, its color on the dots) for event links, the join link and flyers.
export default function DivisionQr({ hat }: { hat: DivisionHat }) {
  return <QRStudioClient embedded divisions={hat.logoUrl ? [{ id: hat.id, name: hat.name, logo: hat.logoUrl }] : []} startWith={{ id: hat.id, color: hat.accent }} />;
}
