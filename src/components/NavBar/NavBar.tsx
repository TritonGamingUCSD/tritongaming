'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import styles from './NavBar.module.css';

const NAV_LINKS = [
  { href: '/about',         label: 'ABOUT' },
  { href: '/events',        label: 'EVENTS' },
  { href: '/divisions',     label: 'DIVISIONS' },
  { href: '/board',         label: 'BOARD' },
  { href: '/sponsors',      label: 'SPONSORS' },
  { href: '/get-involved',  label: 'JOIN' },
];

export default function NavBar() {
  const [offset, setOffset] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [cursorActive, setCursorActive] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const prevScrollY = useRef(0);
  const pathname = usePathname();

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
          .select('id, display_name, avatar_url, role')
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
    document.body.style.cursor = cursorActive
      ? `url('/easter-eggs/byte-cursor.png'), auto`
      : '';
    return () => { document.body.style.cursor = ''; };
  }, [cursorActive]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const authButton = authLoading ? null : profile ? (
    <Link href="/portal" className={styles.authBtn} aria-label="Member portal">
      {profile.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt={profile.display_name || 'Profile'}
          width={28}
          height={28}
          className={styles.authAvatar}
        />
      ) : (
        <div className={styles.authAvatarFallback}>
          {(profile.display_name || 'U')[0].toUpperCase()}
        </div>
      )}
      <span className={styles.authLabel}>PORTAL</span>
    </Link>
  ) : (
    <Link href="/login" className={styles.loginBtn}>
      LOGIN
    </Link>
  );

  return (
    <>
      <nav
        className={`${styles.navbar}${scrolled ? ` ${styles.scrolled}` : ''}`}
        style={{ transform: `translateY(-${offset}px)` }}
        aria-label="Main navigation"
      >
        <div className={styles.bgWrapper} aria-hidden="true">
          <span className={styles.bgText}>TRITON</span>
          <span className={styles.bgText2}>GAMING</span>
        </div>

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
          <li>
            <button
              className={styles.byteBtn}
              onClick={() => setCursorActive((v) => !v)}
              aria-label="Toggle Byte cursor easter egg"
              aria-pressed={cursorActive}
            >
              <Image
                src="/easter-eggs/dez_ezain_byte_full.png"
                alt=""
                width={36}
                height={36}
                className={`${styles.byteIcon} ${cursorActive ? styles.byteActive : ''}`}
              />
            </button>
          </li>
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
            className={styles.byteBtn}
            onClick={() => setCursorActive((v) => !v)}
            aria-label="Toggle Byte cursor easter egg"
            aria-pressed={cursorActive}
          >
            <Image
              src="/easter-eggs/dez_ezain_byte_full.png"
              alt=""
              width={30}
              height={30}
              className={`${styles.byteIcon} ${cursorActive ? styles.byteActive : ''}`}
            />
          </button>
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
                {profile.avatar_url && (
                  <Image src={profile.avatar_url} alt="" width={24} height={24} className={styles.authAvatar} />
                )}
                Member Portal
              </Link>
            ) : (
              <Link href="/login" className={styles.mobileLoginBtn} onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
            )}
          </li>
        </ul>
      </div>
    </>
  );
}
