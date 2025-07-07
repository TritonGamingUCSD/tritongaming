import React from 'react';
import '../styles/LandingPage.css';
import { typography } from '../styles/typography';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <section className="hero">
      <div className="hero-video-container">
            <div className="video-zoom-wrapper">
                <iframe
                className="hero-video"
                src="https://www.youtube.com/embed/Z9yFVDTcpJU?autoplay=1&mute=1&loop=1&playlist=Z9yFVDTcpJU&controls=0&modestbranding=1&showinfo=0&rel=0"
                title="TGEX Highlights"
                frameBorder="0"
                allow="autoplay; fullscreen"
                allowFullScreen
                ></iframe>
            </div>
        </div>
        <div className="hero-content">
          <h1 style={typography.accent}>We are Triton Gaming</h1>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;