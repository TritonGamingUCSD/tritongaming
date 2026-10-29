import Link from 'next/link';
import type { ComponentProps } from 'react';
import LinkPending from './LinkPending';

// `next/link` for the portal. A normal Link asks the server to prepare its page as soon as it scrolls into view, and every portal page is
// per-person (so each of those is a real server run plus a login check). The dashboard alone has dozens of links; with this one nothing
// is requested until a link is clicked. Pass `prefetch` yourself to turn it back on for a particular link.
// Because nothing is prefetched, a click waits on the server, so every link shows a busy cue while it does (see LinkPending).
export default function NoPrefetchLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link prefetch={false} {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}
