import type { Metadata } from 'next';
import VotePage from '../VotePage';

export const metadata: Metadata = { title: 'Vote', robots: { index: false, follow: false } };

// The public place to vote in a poll without an account: /vote (type the code) or /vote/<code> (from the QR code on the big screen).
export default async function Page({ params }: { params: Promise<{ code?: string[] }> }) {
  const code = (await params).code?.[0] ?? '';
  return <VotePage initialCode={/^[0-9]{6}$/.test(code) ? code : ''} />;
}
