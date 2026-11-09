'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, Award, CalendarCheck, CalendarDays, LogOut, Ticket, User, LayoutDashboard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { usesPortal } from '@/lib/portal/audience';
import type { RoleGrant } from '@/lib/portal/capabilities';
import styles from './NavBar.module.css';
import { DISCORD_URL } from '@/lib/site/links';

const NAV_HINT_KEY = 'tg_nav_portal_hint';

// The sticker row: who we are, what's on, who plays, the photos. Joining is the main call to action, so it is not one of the stickers: it is the yellow Join button beside Sign In (and the last line of the phone menu).
// (Sponsors are in the footer; Our Story and Team are inside About; Membership and Get Involved are inside Join.)
const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/divisions', label: 'Divisions' },
  { href: '/media', label: 'Media' },
];
const MENU_LINKS = [...NAV_LINKS, { href: '/join', label: 'Join' }];

// `announcement` is the (server-rendered) announcement strip: a thin bar across the very top, above the logo and buttons. It slides away with them when you scroll down.
export default function NavBar({ announcement, ticker }: { announcement?: React.ReactNode; ticker?: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // The person's roles decide what the account menu offers: students and guests get their own pages (/me), anyone with another role also gets the portal.
  const [roles, setRoles] = useState<RoleGrant[]>([]);
  const [acct, setAcct] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);
  // What the last signed-in visit looked like (kept on this browser), so the Portal button already has the person's picture while the login is being checked.
  const [hint, setHint] = useState<{ avatar: string | null; letter: string } | null>(null);
  const prevScrollY = useRef(0);
  const pathname = usePathname();
  const router = useRouter();
  // Number keys 1 to 5 (the four pages, then Join) jump to a page on a laptop or desktop (like hotkeys in a game); not while typing, and not with a modifier key held.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || window.innerWidth < 1100) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= MENU_LINKS.length) router.push(MENU_LINKS[n - 1].href);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
  // Deliberately NOT next=<current page> — clicking the nav's own login
  // link is "take me into the portal," not a deep link back to whatever
  // public page you happened to be on, so it lands on /portal (the
  // callback route's default when no `next` is given) same as any other
  // direct visit to /login. The middleware's own /portal/* -> /login?next=
  // redirect (when a protected page bounces you here) is untouched — that
  // one *should* return you to the specific page you were trying to reach.
  const loginHref = `/login?next=${encodeURIComponent(pathname && !pathname.startsWith('/login') ? pathname : '/me')}`;

  useEffect(() => {
    setOpen(false);
    setAcct(false);
  }, [pathname]);

  useEffect(() => {
    if (!acct) return;
    const down = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcct(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setAcct(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [acct]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_HINT_KEY);
      if (raw) setHint(JSON.parse(raw));
    } catch {
      /* no storage: no hint */
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').eq('id', user.id).single();
        setProfile(data as Profile | null);
        const { data: held } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
        setRoles((held ?? []) as RoleGrant[]);
        try {
          const p = data as Profile | null;
          if (p) localStorage.setItem(NAV_HINT_KEY, JSON.stringify({ avatar: resolveAvatarUrl(p), letter: (p.display_name || 'U')[0].toUpperCase() }));
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem(NAV_HINT_KEY);
          setHint(null);
        } catch {
          /* ignore */
        }
      }
      setAuthLoading(false);
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        setRoles([]);
        try {
          localStorage.removeItem(NAV_HINT_KEY);
          setHint(null);
        } catch {
          /* ignore */
        }
        setAuthLoading(false);
      } else {
        loadProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      // iOS Safari's elastic overscroll can report scrollY bouncing back
      // from a negative value toward 0 right as you land at the top — a
      // *positive* delta that the logic below would misread as "scrolling
      // down" and hide the nav at exactly the moment it should be most
      // visible. Always force it fully visible at/above the top instead.
      if (currentY <= 0) {
        setOffset(0);
        setScrolled(false);
        prevScrollY.current = currentY;
        return;
      }

      const delta = currentY - prevScrollY.current;
      if (delta > 0) {
        setOffset((prev) => Math.min(prev + delta, 200));
      } else if (delta < 0) {
        setOffset((prev) => Math.max(prev + delta * 2, 0));
      }
      setScrolled(currentY > 60);
      prevScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // While the poster menu is open: the page behind it does not scroll, Escape closes it, Tab stays inside it, and focus returns to the Menu button.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const menu = menuRef.current;
    const focusables = () => Array.from(menu?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const toggle = toggleRef.current;
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      toggle?.focus();
    };
  }, [open]);

  // The Portal button is always there. While the login is still being checked (a slow connection can make that take a while) it already goes to /portal, which sends someone who
  // is not signed in on to the login page by itself, so it works from the first moment.
  const navAvatarUrl = profile ? resolveAvatarUrl(profile) : authLoading ? (hint?.avatar ?? null) : null;
  const showLetter = profile ? (profile.display_name || 'U')[0].toUpperCase() : authLoading ? (hint?.letter ?? null) : null;
  const signedIn = !!profile || authLoading; // (while the login is still being checked, act as signed in: a signed-out visitor is sent on to sign in anyway)
  const staff = usesPortal(roles);
  const student = roles.length > 0 && !staff;
  async function signOut() {
    await createClient().auth.signOut();
    setAcct(false);
    router.refresh();
  }

  return (
    <>
      {/* One row pinned to the top: the logo on the left, the announcement pill in the middle, portal and menu on the right. It slides away when you scroll down. */}
      <header className={`${styles.bar}${scrolled ? ` ${styles.scrolled}` : ''}`} style={{ transform: `translateY(-${offset}px)` }}>
        <Link href="/" className={styles.logo} aria-label="Triton Gaming Home">
          <Image src="/logos/tg_logo.png" alt="Triton Gaming" width={80} height={80} className={styles.logoImg} loading="eager" fetchPriority="high" />
        </Link>

        {/* A laptop or desktop gets a regular navbar with every page in view; phones and tablets keep the Menu button and the poster menu below. */}
        <nav className={styles.deskNav} aria-label="Site pages">
          <span className={styles.shelf}>
            {NAV_LINKS.map(({ href, label }, i) => {
              const on = pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={`${styles.cart} ${on ? styles.cartOn : ''}`} aria-current={on ? 'page' : undefined} title={`Press ${i + 1}`}>
                  <span className={styles.cartNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.cartName}>{label}</span>
                </Link>
              );
            })}
          </span>
          {ticker && <span className={styles.deskTicker}>{ticker}</span>}
        </nav>

        {announcement && <div className={`${styles.stripSlot}${open ? ` ${styles.announceHidden}` : ''}`}>{announcement}</div>}

        <div className={styles.right}>
          <Link href="/join" className={styles.joinCta} aria-current={pathname.startsWith('/join') ? 'page' : undefined}>
            Join
          </Link>
          {profile || authLoading ? (
            <div className={styles.acct} ref={acctRef}>
              <button type="button" className={styles.portal} aria-expanded={acct} aria-haspopup="menu" aria-label="Your account menu" onClick={() => setAcct((v) => !v)}>
                {navAvatarUrl ? (
                  <Image src={navAvatarUrl} alt="" width={24} height={24} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
                ) : showLetter ? (
                  <span className={styles.avatarFallback} aria-hidden="true" data-letter={showLetter} />
                ) : null}
                <span>Me</span>
              </button>
              {acct && (
                <div className={styles.acctMenu} role="menu">
                  <Link role="menuitem" href="/me/events" prefetch={false}>
                    <CalendarCheck size={16} aria-hidden="true" /> Events
                  </Link>
                  <Link role="menuitem" href="/me/tickets" prefetch={false}>
                    <Ticket size={16} aria-hidden="true" /> My Tickets
                  </Link>
                  <Link role="menuitem" href="/me/calendar" prefetch={false}>
                    <CalendarDays size={16} aria-hidden="true" /> Calendar
                  </Link>
                  {student && (
                    <Link role="menuitem" href="/me/rewards" prefetch={false}>
                      <Award size={16} aria-hidden="true" /> Rewards
                    </Link>
                  )}
                  <Link role="menuitem" href="/me/profile" prefetch={false}>
                    <User size={16} aria-hidden="true" /> Profile
                  </Link>
                  {staff && (
                    <Link role="menuitem" href="/portal" prefetch={false} className={styles.acctPortal}>
                      <LayoutDashboard size={16} aria-hidden="true" /> Portal
                    </Link>
                  )}
                  <button role="menuitem" type="button" onClick={signOut}>
                    <LogOut size={16} aria-hidden="true" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href={loginHref} prefetch={false} className={styles.portal} aria-label="Sign in">
              <span>Sign In</span>
            </Link>
          )}
          <button ref={toggleRef} type="button" className={styles.menuBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="poster-menu">
            <span className={styles.bars} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>{open ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </header>

      {/* The poster menu: full screen, big hand-lettered links. */}
      <div
        id="poster-menu"
        ref={menuRef}
        className={`${styles.menu} ${open ? styles.menuOpen : ''}`}
        aria-hidden={!open}
        inert={!open}
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <nav className={styles.menuInner} aria-label="Main navigation">
          <ul className={styles.links} role="list">
            <li style={{ '--i': 0 } as React.CSSProperties}>
              <Link
                href="/"
                className={`${styles.link} ${pathname === '/' ? styles.linkOn : ''}`}
                onClick={() => setOpen(false)}
                aria-current={pathname === '/' ? 'page' : undefined}
              >
                <span className={styles.num}>01</span>
                <span className={styles.word}>Home</span>
                {pathname === '/' && <span className={styles.here}>you are here</span>}
              </Link>
            </li>
            {MENU_LINKS.map(({ href, label }, i) => {
              const on = pathname.startsWith(href);
              return (
                <li key={href} style={{ '--i': i + 1 } as React.CSSProperties}>
                  <Link href={href} className={`${styles.link} ${on ? styles.linkOn : ''}`} onClick={() => setOpen(false)} aria-current={on ? 'page' : undefined}>
                    <span className={styles.num}>{String(i + 2).padStart(2, '0')}</span>
                    <span className={styles.word}>{label}</span>
                    {on && <span className={styles.here}>you are here</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className={styles.side} style={{ '--i': 10 } as React.CSSProperties}>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={styles.discord} onClick={() => setOpen(false)}>
              <Image src="/logos/discord.svg" alt="" width={22} height={22} unoptimized /> Join the Discord <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <Link href={signedIn ? (staff ? '/portal' : '/me/tickets') : loginHref} prefetch={false} className={styles.sideLink} onClick={() => setOpen(false)}>
              {signedIn ? (staff ? 'Open the portal' : 'My tickets and profile') : 'Sign in'} <span aria-hidden="true">→</span>
            </Link>
            <p className={styles.tag}>Gaming Org at UC San Diego</p>
          </div>
        </nav>
      </div>
    </>
  );
}
