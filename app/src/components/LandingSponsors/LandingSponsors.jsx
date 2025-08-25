import React, { useState, useEffect } from 'react';
import './LandingSponsors.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import AlternateTitle from '../AlternateTitle/AlternateTitle';

const LandingSponsors = () => {
    return (
        <div className="landing-sponsors">
          <AlternateTitle fgTitle="Sponsors" bgTitle="Sponsors" />
            
        </div>
    );
};

export default LandingSponsors;
