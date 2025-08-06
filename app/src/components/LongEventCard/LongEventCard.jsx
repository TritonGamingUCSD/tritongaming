import React from 'react';
import { typography } from '../../styles/typography';
import './LongEventCard.css';
import image from '../../assets/images/what_is_triton_gaming_justinlu.jpg'; // HARD CODED IMAGE PLEASE REPLACE LATER

const LongEventCard = ({ event }) => {

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
    <div className="long-event-card">
      <div className="long-event-card-image">
        <img src={event.flyer_url || image} alt={event.name} />
      </div>
      <div className="long-event-card-content">
        <h1 style={{...typography.h1, lineHeight: '35px', fontSize: '33px'}}>{event.full_name}</h1>
        <p style={{ ...typography.h1, lineHeight: '16px', fontSize: '16px' }}>
          {event.date}{' '}
          {dateString}{' '}
          <span style={{ ...typography.accent, lineHeight: '16px',fontSize: '26px', position: 'relative', top: '2px' }}>#</span>{' '}
          <span style={{ ...typography.h1, lineHeight: '16px', fontSize: '16px' }}>{timeString}</span>
        </p>        
        <p style={{...typography.h1, lineHeight: '16px', fontSize: '16px'}}>{event.location}</p>
        <p className="event-description" style={{...typography.body, fontSize: '16px'}}>{event.content}</p>
        <a className="long-event-link"
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...typography.h1,
            fontSize: '23px',
            color: 'var(--white)',
            maxWidth: 'max-content',
          }}
        >
          LEARN MORE &gt;
        </a>

      </div>
    </div>
  );
};


export default LongEventCard;
