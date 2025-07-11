import React, { useState } from 'react';
import './LandingAbout.css';
import aboutPhoto from '../../assets/images/what_is_triton_gaming_justinlu.jpg'; // adjust path as needed
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import scribble from '../../assets/images/scribble.png';

const LandingAbout = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="landing-about">
      <div className="about-container">
        <div className="about-image-wrapper">
          <img src={scribble} alt="Scribble" className="scribble-bg" />
          <img src={aboutPhoto} alt="Triton Gaming Event" className="about-image" />
          <a
            className="photo-credit"
            href="https://www.instagram.com/justinzlu/" // replace with actual handle
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
              ...typography.caption,
              color: isHovered ? colors.blue : colors.black, 
              textDecoration: 'none' }}
          >
            Photo credit: Justin Lu
          </a>
        </div>
        <div className="about-text">
          <h1 style={{ ...typography.h1, color: colors.darkblue }}>What is Triton Gaming?</h1>
          <p style={typography.body}>
            Triton Gaming of UC San Diego is one of the largest, student-ran collegiate gaming organizations in the country.
            We are committed to creating unforgettable community experiences, promoting non-toxicity and diversity in gaming,
            and providing career mentorship and exposure to the esports industry. Throughout the year, we host a long lineup of
            creative and dynamic events, working from peripheral companies to popular personalities on Twitch or in the competitive scene,
            all with the intention of heightening our attendee experience and getting more students into gaming. Whether you’re a casual player or aspiring developer,
            we’re here to help you find your place in the gaming world.
          </p>
        </div>
      </div>
      <div className="title-upcoming-events">
        <h1 style={{ ...typography.accent, color: colors.yellow }} className="upcoming-events-bg">Upcoming Events</h1>
        <h1 style={{ ...typography.h1, color: colors.darkblue }} className="upcoming-events-fg">Upcoming Events</h1>
      </div>
    </section>
  );
};

export default LandingAbout;
