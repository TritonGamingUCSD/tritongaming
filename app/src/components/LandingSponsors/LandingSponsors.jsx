import React from 'react';
import './LandingSponsors.css';
import AlternateTitle from '../AlternateTitle/AlternateTitle';
import SponsorGrid from '../SponsorGrid/SponsorGrid';
import sponsors from '../../data/sponsors.json';


const LandingSponsors = () => {

    return (
        <div className="landing-sponsors">
          <AlternateTitle fgTitle="Sponsors" bgTitle="Sponsors" />
          <SponsorGrid sponsors={sponsors} />
            
        </div>
    );
};

export default LandingSponsors;
