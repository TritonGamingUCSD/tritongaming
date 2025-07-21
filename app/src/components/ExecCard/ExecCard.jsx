import React from 'react';
import './ExecCard.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import defaultpng from '../../assets/images/default.png';

const ExecCard= ({ exec, reverse }) => {
  const { full_name, gamer_tag, bio, year, major, picture_url } = exec.officer;

  function formatNameWithGamerTag(fullName, gamerTag) {
    if (!gamerTag) return fullName;
    const names = fullName.trim().split(' ');
    if (names.length < 2) return fullName; // fallback
    const firstName = names[0];
    const lastName = names.slice(1).join(' ');
    return `${firstName} "${gamerTag}" ${lastName}`;
  }

  return (
    <div className={`exec-card ${reverse ? 'reverse' : ''}`}>
      <div className="exec-image-wrapper">
        <img
          src={picture_url || defaultpng}
          alt={full_name}
          className="exec-image"
        />
      </div>      
      <div className="exec-info">
        {/*<h3 className="exec-title" >{exec.title.toUpperCase()}</h3>*/}
        <h2 className="exec-name" style={{...typography.h1, fontSize: '1.5rem', lineHeight: '2rem'}}>
          {formatNameWithGamerTag(full_name, gamer_tag)}
        </h2>
        <div className="exec-subinfo" style={{...typography.h1, fontSize: '1rem', lineHeight: '1.75rem'}}>
          <p>{exec.title}</p>
          <p>{year}</p>
          <p>{major}</p>
        </div>
        <p className="exec-bio" style={{...typography.body, fontSize: '0.75rem', lineHeight: '1rem'}}>{bio}</p>
      </div>
    </div>
  );
};

export default ExecCard;
