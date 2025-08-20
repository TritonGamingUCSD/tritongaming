import React from 'react';
import './ExecCard.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

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
			<img
				src={picture_url || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
				alt={picture_url ? full_name : ""}
				aria-hidden={!picture_url}
				className={`exec-image ${reverse ? 'reverse' : ''}`}
			/>

      <div className={`exec-info ${reverse ? 'reverse' : ''}`}>
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
      <div className={`exec-background-wrapper ${reverse ? 'reverse' : ''}`}>
        <div className={`exec-background-text ${reverse ? 'reverse' : ''}`}>
          <h2 style={{...typography.accent, color: colors.white, opacity: 0.24, fontSize: '200px', fontWeight: '400'}}>{gamer_tag}</h2>
        </div>
      </div>
    </div>
  );
};

export default ExecCard;
