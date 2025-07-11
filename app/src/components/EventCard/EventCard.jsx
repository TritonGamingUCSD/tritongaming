import React from 'react';
import { typography } from '../../styles/typography';
import './EventCard.css';
import image from '../../assets/images/what_is_triton_gaming_justinlu.jpg';

const EventCard = ({ event }) => {
  return (
    <div className="event-card">
      <div className="event-image-wrapper">
        <img src={image} alt={event.title} className="event-image" />
      </div>
      <div className="info-box">
        <h2 style={{ ...typography.h1, lineHeight: '32px', fontSize: '24px' }}>
          {event.title}
        </h2>
        <p style={{ ...typography.h1, lineHeight: '16px', fontSize: '12px' }}>
          {event.date} # {event.location}
        </p>
        <p
          style={{
            ...typography.body,
            padding: '1rem 0',
            lineHeight: '16px',
            fontSize: '12px',
          }}
        >
          {event.description}
        </p>
        <a
          href={event.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...typography.h1,
            fontSize: '22px', // override if needed
            fontHeight: '16px',
            color: 'var(--white)',
          }}
        >
          LEARN MORE &gt;
        </a>
      </div>
    </div>
  );
};

export default EventCard;
