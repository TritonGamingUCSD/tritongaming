import React from 'react';
import './Footer.css';
import logo from '../../assets/logos/tg_logo_multi.png'; 
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

import EmailIcon from '../../assets/logos/email.svg?react';
import YouTubeIcon from '../../assets/logos/youtube.svg?react';
import DiscordIcon from '../../assets/logos/discord.svg?react';
import TwitchIcon from '../../assets/logos/twitch.svg?react';
import TikTokIcon from '../../assets/logos/tiktok.svg?react';
import LinkedInIcon from '../../assets/logos/linkedin.svg?react';
import InstagramIcon from '../../assets/logos/instagram.svg?react';
import XIcon from '../../assets/logos/x.svg?react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-background-text-wrapper">
        <div className="footer-background-text" style={typography.accent}>TRITON</div>
        <div className="footer-background-text2" style={typography.accent}>GAMING</div>
      </div>

      <div className="footer-left">
        <img src={logo} alt="Triton Gaming Logo" className="footer-logo" />
        <p className="footer-copy" style={{ ...typography.h1, fontSize: '24px', color: colors.white }}>TRITON GAMING © 2025</p>
      </div>

      <div className="footer-right">
        <h3 className="footer-heading" style={{...typography.h1, fontSize: '24px', color: colors.white}}>CONNECT WITH US!</h3>
        <div className="footer-icons">
          <a href="mailto:tritongamingofficial@gmail.com"><EmailIcon /></a>
          <a href="https://discord.gg/tritongaming"><DiscordIcon /></a>
          <a href="https://www.instagram.com/tritongamingsd/"><InstagramIcon /></a>
          <a href="https://twitter.com/tritongamingsd"><XIcon /></a>
          <a href="https://tiktok.com"><TikTokIcon /></a>
          <a href="https://twitch.tv/tritongaming"><TwitchIcon /></a>
          <a href="https://www.youtube.com/@tritongamingofficial"><YouTubeIcon /></a>
          <a href="https://www.linkedin.com/company/triton-gaming/"><LinkedInIcon /></a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
