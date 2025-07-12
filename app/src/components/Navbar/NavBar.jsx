import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../assets/logos/tg_logo_multi.png';
import './NavBar.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import navbarByte from '../../assets/easter_eggs/dez_ezain_byte_full.png'
import byteCursor from '../../assets/easter_eggs/byte_cursor_prototype.png'

const NavBar = () => {
  const [prevScrollPos, setPrevScrollPos] = useState(window.scrollY);
  const [visible, setVisible] = useState(true);
  const [cursorActive, setCursorActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10);
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollPos]);

  useEffect(() => {
    if (cursorActive) {
      document.body.style.cursor = `url(${byteCursor}), auto`;
    }
    else {
      document.body.style.cursor = 'auto';
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [cursorActive]);

  const toggleCursor = () => {
    setCursorActive(prev => !prev);
  }

  return (
    <nav className={`navbar ${visible ? '' : 'hidden'}`}>
      
      <div className="background-text-wrapper">
        <div className="background-text" style={typography.accent}>TRITON</div>
        <div className="background-text2" style={typography.accent}>GAMING</div>
      </div>

      <div className="logo">
        <Link to="/">
          <img src={logo} alt="Triton Gaming" className="logo-img" />
        </Link>
      </div>

      <ul className="nav-links">
        {/* byte cursor swap button */}
        <div className="byte-icon" onClick={toggleCursor}>
          <img
            src={navbarByte}
            alt="Byte Icon"
            className={`navbarbyte ${cursorActive ? 'active' : ''}`}
          />
        </div>
        <li style={{...typography.h3, color: colors.white}}><Link to="/about">ABOUT</Link></li>
        <li style={{...typography.h3, color: colors.white}}><Link to="/events">EVENTS</Link></li>
        <li style={{...typography.h3, color: colors.white}}><Link to="/sponsors">SPONSORS</Link></li>
        <li style={{...typography.h3, color: colors.white}}><Link to="/team">GET INVOLVED</Link></li>
      </ul>
    </nav>
  );
};

export default NavBar;
