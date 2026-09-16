'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { resolveAvatarUrl } from '@/lib/profile';
import styles from './NavBar.module.css';

const NAV_LINKS = [
  { href: '/our-story',     label: 'OUR STORY' },
  { href: '/about',         label: 'ABOUT' },
  { href: '/events',        label: 'EVENTS' },
  { href: '/divisions',     label: 'DIVISIONS' },
  { href: '/sponsors',      label: 'SPONSORS' },
  { href: '/get-involved',  label: 'JOIN' },
];

export default function NavBar() {
  const [offset, setOffset] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
    setMobileOpen(false);
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

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navAvatarUrl = profile ? resolveAvatarUrl(profile) : null;

  const authButton = authLoading ? null : profile ? (
    <Link href="/portal" className={styles.authBtn} aria-label="Member portal">
      {navAvatarUrl ? (
        <Image
          src={navAvatarUrl}
          alt={profile.display_name || 'Profile'}
          width={28}
          height={28}
          className={styles.authAvatar}
          unoptimized
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={styles.authAvatarFallback}>
          {(profile.display_name || 'U')[0].toUpperCase()}
        </div>
      )}
      <span className={styles.authLabel}>PORTAL</span>
    </Link>
  ) : (
    <Link href={loginHref} className={styles.loginBtn} aria-label="Sign in to the member portal">
      <span className={styles.loginBtnIcon} aria-hidden="true"><User size={16} strokeWidth={1.5} /></span>
      Member Portal
    </Link>
  );

  return (
    <>
      <nav
        className={`${styles.navbar}${scrolled ? ` ${styles.scrolled}` : ''}`}
        style={{ transform: `translateY(-${offset}px)` }}
        aria-label="Main navigation"
      >
        <Link href="/" className={styles.logo} aria-label="Triton Gaming Home">
          <Image
            src="/logos/tg_logo_multi.png"
            alt="Triton Gaming"
            width={80}
            height={80}
            className={styles.logoImg}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <ul className={styles.desktopNav} role="list">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`${styles.navLink} ${pathname.startsWith(href) && href !== '/' ? styles.navLinkActive : ''}`}
              >
                {label}
              </Link>
            </li>
          ))}
          <li>{authButton}</li>
        </ul>

        {/* Mobile controls */}
        <div className={styles.mobileControls}>
          <button
            className={`${styles.hamburger} ${mobileOpen ? styles.hamburgerOpen : ''}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`${styles.mobileMenu} ${mobileOpen ? styles.mobileMenuOpen : ''}`}
        aria-hidden={!mobileOpen}
      >
        <button
          className={styles.closeBtn}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          ×
        </button>
        <ul className={styles.mobileNavList} role="list">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={styles.mobileNavLink}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
          <li className={styles.mobileAuthItem}>
            {profile ? (
              <Link href="/portal" className={styles.mobilePortalBtn} onClick={() => setMobileOpen(false)}>
                {navAvatarUrl && (
                  <Image src={navAvatarUrl} alt="" width={24} height={24} className={styles.authAvatar} unoptimized referrerPolicy="no-referrer" />
                )}
                Member Portal
              </Link>
            ) : (
              <Link href={loginHref} className={styles.mobileLoginBtn} onClick={() => setMobileOpen(false)}>
                Member Portal Sign In
              </Link>
            )}
          </li>
        </ul>
      </div>
    </>
  );
}
