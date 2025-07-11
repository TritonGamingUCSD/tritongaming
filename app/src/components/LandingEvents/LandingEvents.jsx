import React, { useRef } from 'react';
import EventCard from '../EventCard/EventCard';
import events from '../../data/events'; // adjust path as needed
import './LandingEvents.css';

const LandingEvents = () => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    const container = scrollRef.current;
    const scrollAmount = container.offsetWidth * 0.9;
    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  return (
    <div className="landing-wrapper">
      <h2 className="landing-heading">Upcoming Events</h2>
      <div className="landing-controls">
        <button className="nav-button" onClick={() => scroll('left')}>‹</button>
        <button className="nav-button" onClick={() => scroll('right')}>›</button>
      </div>
      <div className="event-carousel" ref={scrollRef}>
        {events.map((event, index) => (
          <EventCard key={index} event={event} />
        ))}
      </div>
    </div>
  );
};

export default LandingEvents;
