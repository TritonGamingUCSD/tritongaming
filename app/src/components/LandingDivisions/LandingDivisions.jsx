import React from 'react';
import AlternateTitle from '../AlternateTitle/AlternateTitle';
import './LandingDivisions.css';
import LogoGrid from '../LogoGrid/LogoGrid';
import divisions from '../../data/divisions.json';

const LandingDivisions = () => {
  return(
    <div className='landing-divisions'>
      <AlternateTitle fgTitle="Divisions" bgTitle="Divisions" />
      <LogoGrid logos={divisions} />
    </div>
  );
}

export default LandingDivisions;
