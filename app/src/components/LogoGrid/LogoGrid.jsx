import React from 'react';
import './LogoGrid.css';

const LogoGrid = ({ logos }) => {
  return (
    <div className="logo-grid">
      {logos.map((logo, index) => (
        <div 
          key={index} 
          className={`logo-item logo-size-${logo.size}`}
          style={{ order: logo.order || index }}
        >
          <p>
            {logo.link ? (
              <a href={logo.link} target="_blank" rel="noopener noreferrer">
                <img 
                  src={logo.logo} 
                  alt={logo.name}
                  className="logo-logo"
                />
              </a>
            ) : (
              <img 
                src={logo.logo} 
                alt={logo.name}
                className="logo-logo"
              />
            )}

          </p>
        </div>
      ))}
    </div>
  );
};

export default LogoGrid;

