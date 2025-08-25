import React from 'react';
import { typography } from '../../styles/typography';
import './AccentButton.css';

const AccentButton = ({ text, href, onClick, target = '_blank', className = '', ...props }) => {
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (href) {
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        window.open(href, target);
      } else {
        // Internal navigation - you might want to use React Router here
        window.location.href = href;
      }
    }
  };

  return (
    <button 
      className={`accent-button ${className}`}
      onClick={handleClick}
      {...props}
    >
      <span style={{...typography.h1, fontSize: '1rem', lineHeight: '20px'}}>{text}</span>
    </button>
  );
}

export default AccentButton;

