import React from 'react';
import AlternateTitle from '../AlternateTitle/AlternateTitle';
import './LandingRecruitment.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

const LandingRecruitment = () => {
  return(
    <div className='landing-recruitment'>
      <AlternateTitle fgTitle="Interested in Joining?" bgTitle="Interested in Joining?" />
      <div className="statistics-container">
        <div className="background-text-wrapper">
          <div className="background-text" style={typography.accent}>TRITON</div>
          <div className="background-text2" style={typography.accent}>GAMING</div>
          <div className="background-text3" style={typography.accent}>TRITON</div>
          <div className="background-text4" style={typography.accent}>GAMING</div>
        </div>
        <h1 style={{...typography.h1, color:colors.white}}>
          Check back for more info about recruitment!
        </h1>
      </div>
    </div>
  );
}

export default LandingRecruitment;
