import React from 'react';
import './LandingSponsors.css';
import AlternateTitle from '../AlternateTitle/AlternateTitle';
import LogoGrid from '../LogoGrid/LogoGrid';
import sponsors from '../../data/sponsors.json';


const LandingSponsors = () => {

    return (
        <div className="landing-sponsors">
          <AlternateTitle fgTitle="Sponsors" bgTitle="Sponsors" />
          <LogoGrid logos={sponsors} />
            
        </div>
    );
};

export default LandingSponsors;
