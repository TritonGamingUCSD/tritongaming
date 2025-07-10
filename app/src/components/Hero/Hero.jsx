import React from 'react';
import './Hero.css';
import { typography } from '../../styles/typography'; // Import the typography object from typograph
import { colors } from '../../styles/colors';

const Hero = () => {
  return (
    <div className="landing-page">
      <section className="hero">
        <video autoPlay loop muted className="hero-video">
          <source src="/videos/tgexhighlight.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="hero-content">
          <h1 style={{ ...typography.accent, color: colors.yellow }}>We are Triton Gaming</h1>
        </div>
        <div className="hero-bottom-text">
          <span style={{ ...typography.h1, color: colors.yellow }}>EVENTS</span>
          <span style={{ ...typography.h1, color: colors.yellow }}>CREATIVITY</span>
          <span style={{ ...typography.h1, color: colors.yellow }}>COMMUNITY</span>
          <span style={{ ...typography.h1, color: colors.yellow }}>INDUSTRY</span>
        </div>
      </section>
    </div>
  );
};

export default Hero;