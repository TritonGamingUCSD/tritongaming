//import React, { useRef } from 'react';
//import EventCard from '../EventCard/EventCard';
//import events from '../../data/events'; // adjust path as needed
//import './LandingEvents.css';
//import { typography } from '../../styles/typography';
//import { colors } from '../../styles/colors';
//
//const LandingEvents = () => {
//  const scrollRef = useRef(null);
//
//  const scroll = (direction) => {
//    const container = scrollRef.current;
//    const scrollAmount = container.offsetWidth * 0.9;
//    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
//  };
//
//  return (
//    <div className="landing-events">
//      <div className="title-upcoming-events">
//        <h1 style={{ ...typography.accent, color: colors.yellow }} className="upcoming-events-bg">Upcoming Events</h1>
//        <h1 style={{ ...typography.h1, color: colors.darkblue }} className="upcoming-events-fg">Upcoming Events</h1>
//      </div>
//      <div className="landing-wrapper">
//        <div className="landing-controls">
//          <button className="nav-button" onClick={() => scroll('left')}>‹</button>
//          <button className="nav-button" onClick={() => scroll('right')}>›</button>
//        </div>
//        <div className="event-carousel" ref={scrollRef}>
//          {events.map((event, index) => (
//            <EventCard key={index} event={event} />
//          ))}
//        </div>
//      </div>
//    </div>
//  );
//};
//
//export default LandingEvents;
import React, { useRef, useState, useEffect } from 'react';
import EventCard from '../EventCard/EventCard';
import events from '../../data/events';
import './LandingEvents.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

const LandingEvents = () => {
  const scrollRef = useRef(null);
  const cardRefs = useRef([]); // Array of refs for each card
  const [focusedIndex, setFocusedIndex] = useState(null);

  const scroll = (direction) => {
    const container = scrollRef.current;
    const scrollAmount = container.offsetWidth * 0.9;
    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  const handleFocus = (index) => {
    setFocusedIndex(index);

    // Scroll to center the card
    const container = scrollRef.current;
    const card = cardRefs.current[index];
    if (container && card) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.left - containerRect.left - (container.offsetWidth / 2) + (card.offsetWidth / 2);
      container.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    handleFocus(0);
  }, []);

  return (
    <div className="landing-events">
      <div className="title-upcoming-events">
        <h1 style={{ ...typography.accent, color: colors.yellow }} className="upcoming-events-bg">Upcoming Events</h1>
        <h1 style={{ ...typography.h1, color: colors.darkblue }} className="upcoming-events-fg">Upcoming Events</h1>
      </div>
      <div className="landing-wrapper">
        {/*<div className="landing-controls">
          <button className="nav-button" onClick={() => scroll('left')}>‹</button>
          <button className="nav-button" onClick={() => scroll('right')}>›</button>
        </div>*/}
        <div className="event-carousel" ref={scrollRef}>
          {events.map((event, index) => (
            <div
              key={index}
              ref={(el) => (cardRefs.current[index] = el)}
              onClick={() => handleFocus(index)}
              className={`event-card-wrapper ${focusedIndex !== null && focusedIndex !== index ? 'faded' : ''}`}
            >
              <EventCard event={event} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandingEvents;
