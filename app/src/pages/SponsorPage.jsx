import React from 'react';
import AlternateTitle from '../components/AlternateTitle/AlternateTitle';
import './SponsorPage.css'
import { typography } from '../styles/typography';
import { colors } from '../styles/colors';
import SponsorGrid from '../components/SponsorGrid/SponsorGrid';
import sponsors from '../data/sponsors.json';

const SponsorPage = () => {
  return (
    <div className="sponsor-page">
      <AlternateTitle fgTitle="Driven By Purpose" bgTitle="Driven By Purpose" />
      <div className="bar" style={{...typography.h1, color: colors.white, height: '50px'}}>
        <h1 style={{fontSize: '18px', fontWeight: '500', width: '100%'}}> At Triton Gaming, community comes first </h1>
      </div>
      <div>
        <p style={{...typography.body}}>
          We host large scale events such as LANs and gaming expos, to provide a space for gamers to explore, interact, and thrive. Our diverse history has welcomed students of all backgrounds—from casual to competitive—into a place they can call home.
        </p>
      </div>
      <AlternateTitle fgTitle="Current Sponsors" bgTitle="Current Sponsors" />
      <div className='current-sponsors'>
        <SponsorGrid sponsors={sponsors}/>
      </div>
      <AlternateTitle fgTitle="What we offer" bgTitle="What we offer" />
      <div style={{...typography.body}}>
        <p>We strive to provide the best experience for both our partners and community through innovative opportunities and activations.</p>
        <p>Directly engage with attendees through our attractions, co-host competitions and public tournaments, or engage the audience in a panel for more personal interactions with our diverse gaming community.</p>
        <p>Whatever you’re thinking of, Triton Gaming will do our best to make happen!</p>
      </div>
      <AlternateTitle fgTitle="How to Sponsor" bgTitle="How to Sponsor" />
      <div className="bar" style={{...typography.h1, fontSize: '24px', color: colors.white, height: '150px'}}>
        <h1>
          Reach out to us at:{' '} 
          <a href="mailto:tritongaming@gmail.com" className="email-link">
              tritongaming@gmail.com
          </a>
        </h1>
      </div>
    </div>
  );

}

export default SponsorPage;

