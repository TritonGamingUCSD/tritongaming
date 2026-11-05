import { ReactNode } from 'react';
import { GROUP_ORDER } from './hubConstants';

export type HubGroup = (typeof GROUP_ORDER)[number];

export interface HubSection {
  id: string;
  icon: ReactNode;
  label: string;
  description: string;
  badge?: string | number;
  content: ReactNode;
  group: HubGroup;
  /** Extra weight for a slot on the mobile bottom bar — what's relevant to this person right now. */
  dockBoost?: number;
  /** A shorter name for the phone's bottom bar. */
  dockLabel?: string;
  /** Never gets a bottom-bar slot (still reachable from More). */
  dockExclude?: boolean;
  /** Never suggested under "For you" on the dashboard (still in the sidebar and All pages). */
  homeExclude?: boolean;
  /** Not listed in the desktop sidebar (reached another way: the name at the top, a footer button, a link inside another section). Still on the home grid and the phone's More sheet. */
  railHidden?: boolean;
}

export interface HubIdentity {
  name: string;
  avatarUrl: string | null;
  roleLabel: string;
  /** The member level (e.g. "Silver") and how far to the next one (0 to 100), shown as a ring around the picture. */
  level?: string;
  progress?: number;
  roles?: { label: string; color: string }[];
}

export interface GroupedSection {
  group: HubGroup;
  items: HubSection[];
}

// Replaces the old sidebar as the portal's primary navigation on mobile: a
// bottom tab bar (+ "More" sheet) that swaps in a section's full-screen
// panel on tap, with a plain fade/slide (see the panel's motion.div below —
// no shared-layout zoom anymore now that there's no card grid left to zoom
// from). On desktop, DesktopShell below takes over instead — see its own
// comment for why. Each section's real content is pre-rendered server-side
// and just handed in — this component only owns which one is currently open.
//
// openId is local state, not derived straight from the URL — every section's
// content is already sitting in `sections` (fetched once, up front), so
// opening a card is a pure UI change and should be instant. Deriving from
// useSearchParams() directly made every click wait on a router.replace()
// round trip (this page is force-dynamic) before the animation could even
// start, which is what made it feel laggy. The URL is still kept in sync —
// via router.replace after the fact, and via the effect below picking up
// changes that arrive from *outside* this component (e.g. a <Link> to
// /portal/x elsewhere on the same route) — just without the UI
// waiting on it.
// onOpenChange reports whether a panel is open so a sibling (the portal's
// "next ticket" banner) can react to that directly — e.g. hide itself while
// a section takes over the screen on mobile.
export interface HubFrame {
  greeting: string;
  tiles: ReactNode;
  viewAs: ReactNode;
  banners?: ReactNode;
}
