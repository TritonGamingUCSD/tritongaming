import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import logo from '../../assets/logos/tg_logo_multi.png';
import './NavBar.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import navbarByte from '../../assets/easter_eggs/dez_ezain_byte_full.png';
import byteCursor from '../../assets/easter_eggs/byte_cursor_prototype.png';

const NavBar = () => {
  const [prevScrollY, setPrevScrollY] = useState(window.scrollY);
  const [offset, setOffset] = useState(0);
  const [cursorActive, setCursorActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - prevScrollY;
      if (delta > 0) {
        setOffset((prev) => Math.min(prev + delta, 200));
      } else if (delta < 0) {
        setOffset((prev) => Math.max(prev + delta * 2, 0));
      }
      setPrevScrollY(currentY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollY]);

  useEffect(() => {
    if (cursorActive) {
      document.body.style.cursor = `url(${byteCursor}), auto`;
    } else {
      document.body.style.cursor = 'auto';
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [cursorActive]);

  // Prevent body scroll when mobile menu is open
//  useEffect(() => {
//    if (mobileMenuOpen) {
//      document.body.style.overflow = 'hidden';
//    } else {
//      document.body.style.overflow = 'unset';
//    }
//    return () => {
//      document.body.style.overflow = 'unset';
//    };
//  }, [mobileMenuOpen]);

  const toggleCursor = () => {
    setCursorActive((prev) => !prev);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // Mobile menu component
  const MobileMenu = () => (
    <div className="mobile-menu-overlay">
      <div className="mobile-menu-content">
        <button 
          className="close-menu"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        >
          ×
        </button>
        <ul className="mobile-nav-links">
          <li>
            <Link 
              to="/about" 
              onClick={closeMobileMenu}
              style={{ ...typography.h3, color: colors.white }}
            >
              ABOUT
            </Link>
          </li>
          <li>
            <Link 
              to="/events" 
              onClick={closeMobileMenu}
              style={{ ...typography.h3, color: colors.white }}
            >
              EVENTS
            </Link>
          </li>
          <li>
            <Link 
              to="/sponsors" 
              onClick={closeMobileMenu}
              style={{ ...typography.h3, color: colors.white }}
            >
              SPONSORS
            </Link>
          </li>
          <li>
            <Link 
              to="/team" 
              onClick={closeMobileMenu}
              style={{ ...typography.h3, color: colors.white }}
            >
              GET INVOLVED
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <nav
        className="navbar"
        style={{
          transform: `translateY(-${offset}px)`,
          transition: 'transform 0.2s ease',
        }}
      >
        <div className="background-text-wrapper">
          <div className="background-text" style={typography.accent}>TRITON</div>
          <div className="background-text2" style={typography.accent}>GAMING</div>
        </div>
        
        <div className="logo">
          <Link to="/">
            <img src={logo} alt="Triton Gaming" className="logo-img" />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <ul className="nav-links desktop-nav">
          <div className="byte-icon" onClick={toggleCursor}>
            <img
              src={navbarByte}
              alt="Byte Icon"
              className={`navbarbyte ${cursorActive ? 'active' : ''}`}
            />
          </div>
          <li style={{ ...typography.h3, color: colors.white }}>
            <Link to="/about">ABOUT</Link>
          </li>
          <li style={{ ...typography.h3, color: colors.white }}>
            <Link to="/events">EVENTS</Link>
          </li>
          <li style={{ ...typography.h3, color: colors.white }}>
            <Link to="/sponsors">SPONSORS</Link>
          </li>
          <li style={{ ...typography.h3, color: colors.white }}>
            <Link to="/team">GET INVOLVED</Link>
          </li>
        </ul>

        {/* Mobile Hamburger Menu */}
        <div className="mobile-nav">
          <div className="byte-icon mobile-byte" onClick={toggleCursor}>
            <img
              src={navbarByte}
              alt="Byte Icon"
              className={`navbarbyte ${cursorActive ? 'active' : ''}`}
            />
          </div>
          <button 
            className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      {/* Render mobile menu using portal */}
      {mobileMenuOpen && createPortal(<MobileMenu />, document.body)}
    </>
  );
};

export default NavBar;

