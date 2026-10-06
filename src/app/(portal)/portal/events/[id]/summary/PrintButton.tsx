'use client';

import { Printer } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}><Printer size={15} strokeWidth={1.75} aria-hidden="true" /> Save as PDF</Button>
  );
}
