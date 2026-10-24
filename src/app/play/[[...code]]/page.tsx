import type { Metadata } from 'next';
import GuestPlay from '../GuestPlay';

export const metadata: Metadata = { title: 'Play Trivia', robots: { index: false, follow: false } };

// The public place to join a Trivia game without an account: /play (type the code) or /play/<code> (from the QR code on the big screen).
export default async function Page({ params }: { params: Promise<{ code?: string[] }> }) {
  const code = (await params).code?.[0] ?? '';
  return <GuestPlay initialCode={code} />;
}
