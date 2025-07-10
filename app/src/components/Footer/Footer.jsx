import React from 'react';
import './Footer.css';
import logo from '../../assets/logos/tg_logo_multi.png'; 

import EmailIcon from '../../assets/logos/email.svg?react';
import YouTubeIcon from '../../assets/logos/youtube.svg?react';
import DiscordIcon from '../../assets/logos/discord.svg?react';
import TwitchIcon from '../../assets/logos/twitch.svg?react';
import TikTokIcon from '../../assets/logos/tiktok.svg?react';
import LinkedInIcon from '../../assets/logos/linkedin.svg?react';
import InstagramIcon from '../../assets/logos/instagram.svg?react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-background-text">TRITON GAMING</div>

      <div className="footer-left">
        <img src={logo} alt="Triton Gaming Logo" className="footer-logo" />
        <p className="footer-copy">TRITON GAMING © 2025</p>
      </div>

      <div className="footer-right">
        <h3 className="footer-heading">CONNECT WITH US!</h3>
        <div className="footer-icons">
          <a href="mailto:example@email.com"><EmailIcon /></a>
          <a href="https://youtube.com"><YouTubeIcon /></a>
          <a href="https://discord.com"><DiscordIcon /></a>
          <a href="https://twitch.tv"><TwitchIcon /></a>
          <a href="https://tiktok.com"><TikTokIcon /></a>
          <a href="https://linkedin.com"><LinkedInIcon /></a>
          <a href="https://instagram.com"><InstagramIcon /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
