'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './NavBar.module.css';

const NAV_LINKS = [
  { href: '/about', label: 'ABOUT' },
  { href: '/events', label: 'EVENTS' },
  { href: '/sponsors', label: 'SPONSORS' },
  { href: '/get-involved', label: 'GET INVOLVED' },
];

export default function NavBar() {
  const [offset, setOffset] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [cursorActive, setCursorActive] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevScrollY = useRef(0);

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

  // Trap scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
              <Link href={href} className={styles.navLink}>{label}</Link>
            </li>
          ))}
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
              <Link href={href} className={styles.mobileNavLink} onClick={() => setMobileOpen(false)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
