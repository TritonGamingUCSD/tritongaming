import React from 'react';
import './Hero.css';
import { typography } from '../../styles/typography'; // Import the typography object from typograph
import { colors } from '../../styles/colors';

const Hero = () => {
  return (
      <section className="hero">
        <video autoPlay loop muted className="hero-video">
          <source src="/videos/tgexhighlight.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="video-gradient"></div>
        <div className="hero-content">
          <h1 style={{ ...typography.accent, color: colors.yellow, textShadow: '4px 4px 10px rgba(0, 0, 0, 0.8)', fontWeight: '500' }}>We are Triton Gaming</h1>
        </div>
        <div className="hero-bottom-text">
          <span style={{ ...typography.h1, fontSize: '36px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>EVENTS</span>
          <span style={{ ...typography.accent, fontSize: '72px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>#</span>
          <span style={{ ...typography.h1, fontSize: '36px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>CREATIVITY</span>
          <span style={{ ...typography.accent, fontSize: '72px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>#</span>
          <span style={{ ...typography.h1, fontSize: '36px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>COMMUNITY</span>
          <span style={{ ...typography.accent, fontSize: '72px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>#</span>
          <span style={{ ...typography.h1, fontSize: '36px', color: colors.yellow, textShadow: '2px 2px 6px rgba(0, 0, 0, 0.6)' }}>INDUSTRY</span>
        </div>
      </section>
  );
};

export default Hero;
