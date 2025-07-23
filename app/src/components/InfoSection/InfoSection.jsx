import React, { useState } from 'react';
import './InfoSection.css';
import scribble from '../../assets/images/scribble.png';
import { colors } from '../../styles/colors';
import { typography } from '../../styles/typography';

const InfoSection = ({ title, text, image, imageAlt, reverse, tag, photoCredit, photoCreditLink }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
    <div className={`info-section ${reverse ? 'reverse' : ''}`}>
      <div className="info-image-wrapper">
        <img src={scribble} alt="Scribble" className="scribble-bg" />
        <img src={image} alt={imageAlt} className="info-image" />
        <a 
            className="photo-credit"
            href={photoCreditLink}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                ...typography.caption,
                color: isHovered ? colors.blue : colors.black, 
                textDecoration: 'none' }}
        >
            Photo Credit: {photoCredit}
        </a>
      </div>
      <div className="info-content">
        <h1 style={{ ...typography.h1, color: colors.darkblue }} className="info-title">{title}</h1>
        <p style={typography.body} className="info-description">{text}</p>
      </div>
    </div>
  );
};

export default InfoSection;
