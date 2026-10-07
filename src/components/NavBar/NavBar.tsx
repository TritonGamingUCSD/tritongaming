'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { resolveAvatarUrl } from '@/lib/members/profile';
import styles from './NavBar.module.css';
import { DISCORD_URL } from '@/lib/site/links';

const NAV_LINKS = [
  { href: '/our-story',     label: 'Our Story' },
  { href: '/team',          label: 'Team' },
  { href: '/events',        label: 'Events' },
  { href: '/divisions',     label: 'Divisions' },
  { href: '/media',         label: 'Media' },
  { href: '/sponsors',      label: 'Sponsors' },
  { href: '/membership',    label: 'Membership' },
  { href: '/get-involved',  label: 'Get Involved' },
];


// `announcement` is the (server-rendered) announcement pill; it sits in the same row as the logo and the Portal / Menu stickers.
export default function NavBar({ announcement }: { announcement?: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const prevScrollY = useRef(0);
  const pathname = usePathname();
  // Deliberately NOT next=<current page> — clicking the nav's own login
  // link is "take me into the portal," not a deep link back to whatever
  // public page you happened to be on, so it lands on /portal (the
  // callback route's default when no `next` is given) same as any other
  // direct visit to /login. The middleware's own /portal/* -> /login?next=
  // redirect (when a protected page bounces you here) is untouched — that
  // one *should* return you to the specific page you were trying to reach.
  const loginHref = '/login';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, custom_avatar_url')
          .eq('id', user.id)
          .single();
        setProfile(data as Profile | null);
      }
      setAuthLoading(false);
    }

    loadProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
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
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const toggle = toggleRef.current;
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); toggle?.focus(); };
  }, [open]);

  const navAvatarUrl = profile ? resolveAvatarUrl(profile) : null;

  const portalHref = profile ? '/portal' : loginHref;

  return (
    <>
      {/* One row pinned to the top: the logo on the left, the announcement pill in the middle, portal and menu on the right. It slides away when you scroll down. */}
      <header className={`${styles.bar}${scrolled ? ` ${styles.scrolled}` : ''}`} style={{ transform: `translateY(-${offset}px)` }}>
        <Link href="/" className={styles.logo} aria-label="Triton Gaming Home">
          <Image src="/logos/tg_logo.png" alt="Triton Gaming" width={80} height={80} className={styles.logoImg} loading="eager" fetchPriority="high" />
        </Link>

        {announcement && <div className={`${styles.announce}${open ? ` ${styles.announceHidden}` : ''}`}>{announcement}</div>}

        <div className={styles.right}>
          {!authLoading && (
            <Link href={portalHref} prefetch={false} className={styles.portal} aria-label={profile ? 'Member portal' : 'Sign in to the member portal'}>
              {profile && navAvatarUrl ? (
                <Image src={navAvatarUrl} alt="" width={24} height={24} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
              ) : profile ? (
                <span className={styles.avatarFallback} aria-hidden="true" data-letter={(profile.display_name || 'U')[0].toUpperCase()} />
              ) : null}
              <span>Portal</span>
            </Link>
          )}
          <button
            ref={toggleRef}
            type="button"
            className={styles.menuBtn}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="poster-menu"
          >
            <span className={styles.bars} aria-hidden="true"><i /><i /><i /></span>
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
              <Link href="/" className={`${styles.link} ${pathname === '/' ? styles.linkOn : ''}`} onClick={() => setOpen(false)} aria-current={pathname === '/' ? 'page' : undefined}>
                <span className={styles.num}>01</span><span className={styles.word}>Home</span>
                {pathname === '/' && <span className={styles.here}>you are here</span>}
              </Link>
            </li>
            {NAV_LINKS.map(({ href, label }, i) => {
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
            <Link href={portalHref} prefetch={false} className={styles.sideLink} onClick={() => setOpen(false)}>
              {profile ? 'Open your member portal' : 'Member portal sign in'} <span aria-hidden="true">→</span>
            </Link>
            <p className={styles.tag}>Gaming Org at UC San Diego</p>
          </div>
        </nav>
      </div>
    </>
  );
}
