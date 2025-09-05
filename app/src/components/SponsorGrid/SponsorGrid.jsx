import React from 'react';
import './SponsorGrid.css';

const SponsorGrid = ({ sponsors }) => {
  return (
    <div className="sponsor-grid">
      {sponsors.map((sponsor, index) => (
        <div 
          key={index} 
          className={`sponsor-item sponsor-size-${sponsor.size}`}
          style={{ order: sponsor.order || index }}
        >
          <p>
            <a href={sponsor.link}>
              <img 
                src={sponsor.logo} 
                alt={sponsor.name}
                className="sponsor-logo"
              />
            </a>
          </p>
        </div>
      ))}
    </div>
  );
};

export default SponsorGrid;

