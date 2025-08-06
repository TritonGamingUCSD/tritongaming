import React from 'react';
import { typography } from '../../styles/typography';
import './EventCard.css';
import image from '../../assets/images/what_is_triton_gaming_justinlu.jpg'; // HARD CODED IMAGE PLEASE REPLACE LATER

const EventCard = ({ event }) => {

  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);

  const isSameDay = startDate.toDateString() === endDate.toDateString();

  if (isSameDay) {
    var dateString = startDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  } else {
    const sameMonth = startDate.getMonth() === endDate.getMonth();
    const sameYear = startDate.getFullYear() === endDate.getFullYear();

    const startOpts = {
      month: "long",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    };

    const endOpts = {
      month: sameMonth ? undefined : "long",
      day: "numeric",
      year: "numeric",
    };

    const startPart = startDate.toLocaleDateString("en-US", startOpts);
    const endPart = endDate.toLocaleDateString("en-US", endOpts);

    var dateString = `${startPart} – ${endPart}`;
  }

  const timeString = `${startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;


  return (
    <div className="event-card">
      <div className="event-image-wrapper">
        <img src={event.flyer_url || image} alt={event.full_name} className="event-image" />
      </div>
      <div className="info-box">
        <h2 style={{ ...typography.h1, lineHeight: '32px', fontSize: '24px' }}>
          {event.full_name}
        </h2>
        <p style={{ ...typography.h1, lineHeight: '16px', fontSize: '12px' }}>
          {event.date}{' '}
          {dateString}{' '}
          <span style={{ ...typography.accent, lineHeight: '18px', fontSize: '18px', position: 'relative', top: '2px' }}>#</span>{' '}
          <span style={{ ...typography.h1, lineHeight: '16px', fontSize: '12px' }}>{timeString}</span>
        </p>        
        <p>
          <span style={{ ...typography.h1, lineHeight: '16px', fontSize: '12px' }}>{event.location}</span>
        </p>        
        <p className="event-short-description"
          style={{
            ...typography.body,
            lineHeight: '16px',
            fontSize: '12px',
          }}
        >
          {event.content.length > 280 ? `${event.content.slice(0, 280)}...` : event.content}
        </p>
        <a className="event-link"
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...typography.h1,
            fontSize: '22px', 
            color: 'var(--white)',
            maxWidth: 'max-content'
          }}
        >
          LEARN MORE &gt;
        </a>
      </div>
    </div>
  );
};

export default EventCard;
