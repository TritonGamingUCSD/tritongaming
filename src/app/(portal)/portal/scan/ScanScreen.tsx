'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UniversalScanner from '@/components/portal/UniversalScanner';
import Loading from '@/components/Loading/Loading';

// Scanning is for phones and tablets (the camera faces the same way as the screen). On a computer this page sends people to where they type the code instead.
export default function ScanScreen({ staff, redemptions, code }: { staff: boolean; redemptions: boolean; code?: string }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)').matches || !!code; // (a code's own page works on any device: it needs no camera)
    setOk(touch);
    if (!touch) router.replace(staff ? '/portal/checkin' : '/portal/meetings/mine');
  }, [router, staff, code]);
  if (!ok) return <Loading label="Opening the scanner…" />;
  return <UniversalScanner staff={staff} redemptions={redemptions} initialCode={code} onClose={() => (window.history.length > 1 ? router.back() : router.push('/portal'))} />;
}
