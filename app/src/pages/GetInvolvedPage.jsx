import React from 'react';
import AlternateTitle from '../components/AlternateTitle/AlternateTitle';
import './GetInvolvedPage.css';
import { typography } from '../styles/typography';
import {colors} from '../styles/colors';


const GetInvolvedPage = () => {
  return(
    <div className="get-involved">
      <AlternateTitle fgTitle="Join Us" bgTitle="Join Us" />
      <div>
        <p style={{...typography.body}}>
          Join us at our events, connect with us on social media, and hang out at our socials! Stay in the loop by following us on Discord and Instagram for the latest updates on everything happening with Triton Gaming.
        </p>
      </div>
      <AlternateTitle fgTitle="Become an Officer" bgTitle="Become an Officer" />
      <div>
        <p style={{...typography.body}}>
          Interested in joining us as an officer? We open applications twice a year during Fall and Winter—come to our GBMs or check us out on social media for more information!
        </p>
      </div>
    </div>
  );
}

export default GetInvolvedPage;
