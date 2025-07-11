import React from 'react';
import { typography } from '../../styles/typography';
import './EventCard.css';

const EventCard = ({ event }) => {
  return (
    <div className="event-card">
      <h2 style={{...typography.h1, fontSize: '24px'}}>{event.title}</h2>
      <p style={{...typography.h1, fontSize: '12px'}}> {event.date} - {event.location}</p>
      <p style={typography.body}>{event.description}</p>
      <a href={event.link} target="_blank" rel="noopener noreferrer">
        Learn More &gt;
      </a>
    </div>
  );
};


export default EventCard;
