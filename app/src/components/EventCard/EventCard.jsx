import React from 'react';
import { typography } from '../../styles/typography';
import './EventCard.css';
import image from '../../assets/images/what_is_triton_gaming_justinlu.jpg'; // HARD CODED IMAGE PLEASE REPLACE LATER

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
          {event.date}{' '}
          <span style={{ ...typography.accent, lineHeight: '18px', fontSize: '18px', position: 'relative', top: '2px' }}>#</span>{' '}
          <span style={{ ...typography.h1, lineHeight: '16px', fontSize: '12px' }}>{event.location}</span>
        </p>        <p
          style={{
            ...typography.body,
            lineHeight: '16px',
            fontSize: '12px',
            paddingTop: '1rem',
          }}
        >
          {event.description.length > 280 ? `${event.description.slice(0, 280)}...` : event.description}
        </p>
        <a className="event-link"
          href={event.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...typography.h1,
            fontSize: '22px', 
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
