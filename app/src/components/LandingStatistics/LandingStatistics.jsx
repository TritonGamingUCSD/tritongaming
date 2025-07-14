import React, { useState, useEffect } from 'react';
import './LandingStatistics.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

const LandingStatistics = () => {
  return (
    <div className="landing-statistics">
      <div className="statistics-container">
        <div className="background-text-wrapper">
          <div className="background-text" style={typography.accent}>TRITON</div>
          <div className="background-text2" style={typography.accent}>GAMING</div>
          <div className="background-text3" style={typography.accent}>TRITON</div>
          <div className="background-text4" style={typography.accent}>GAMING</div>
        </div>
        <div className="stats-container">
          <StatItem value="1.5M+" label="Social Media Reach" />
          <StatItem value="15,700+" label="Total Social Following" />
          <StatItem value="3000+" label="Total Attendees Per Year" />
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ value, label }) => {
  const [count, setCount] = useState(0);
  const duration = 3000; // animation duration in ms

  // Extract numeric value from string
  const isFloat = value.includes('.');
  const target = parseFloat(value.replace(/[^0-9.]/g, ''));

  useEffect(() => {
    let start = null;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const current = isFloat
        ? (progress * target).toFixed(1)
        : Math.floor(progress * target);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [target, isFloat]);

  // Format with units and commas
  const display = isFloat ? `${count}M+` : `${Number(count).toLocaleString()}+`;

  return (
    <div className="stat-item">
    <div className="stat-value-wrapper">
        <h1
        style={{ ...typography.h1, color: colors.white }}
        className="stat-value"
        >
        {display}
        </h1>
    </div>
    <p
        className="stat-label"
        style={{ ...typography.h2, fontSize: '12px', color: colors.white }}
    >
        {label}
    </p>
    </div>
  );
};

export default LandingStatistics;
