import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/MULTI COLOR LOGO.png';
import '../styles/NavBar.css';

const NavBar = () => {
  const [prevScrollPos, setPrevScrollPos] = useState(window.scrollY);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      setVisible(prevScrollPos > currentScrollPos || currentScrollPos < 10);
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prevScrollPos]);

  return (
    <nav className={`navbar ${visible ? '' : 'hidden'}`}>
      <div className="logo">
        <Link to="/">
          <img src={logo} alt="Triton Gaming" className="logo-img" />
        </Link>
      </div>
      <ul className="nav-links">
        <li><Link to="/about">ABOUT</Link></li>
        <li><Link to="/events">EVENTS</Link></li>
        <li><Link to="/sponsors">SPONSORS</Link></li>
        <li><Link to="/team">GET INVOLVED</Link></li>
      </ul>
    </nav>
  );
};

export default NavBar;
