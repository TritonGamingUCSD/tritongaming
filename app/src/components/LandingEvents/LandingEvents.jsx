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
  const cardRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(events.length); 
  //const extendedEvents = [events[events.length - 1], ...events, events[0]]; // Add duplicate head and tail
  const extendedEvents = [...events, ...events, ...events];

  const scrollToCard = (index, smooth = true) => {
    const container = scrollRef.current;
    const card = cardRefs.current[index];
    if (container && card) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.left - containerRect.left - (container.offsetWidth / 2) + (card.offsetWidth / 2);
      container.scrollBy({ left: offset, behavior: 'smooth' });
      container.scrollBy({ left: offset, behavior: smooth ? 'smooth' : 'instant' });
    }
  };

  useEffect(() => {
    handleFocus(0);
  const handleFocus = (index) => {
    setFocusedIndex(index);
    scrollToCard(index);
  };

  const handleScrollEnd = () => {
    if (focusedIndex === events.length - 1) {
      const nextIndex = 2 * events.length - 1;
      setFocusedIndex(nextIndex);
      setTimeout(() => scrollToCard(nextIndex, false), 150);
    } else if (focusedIndex === 2 * events.length) {
      setFocusedIndex(events.length);
      setTimeout(() => scrollToCard(events.length, false), 150);
    }
  };

  useEffect(() => {
    scrollToCard(focusedIndex, false);
  }, []);

  useEffect(() => {
    // Handle scroll end detection
    const container = scrollRef.current;
    let timeout;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        handleScrollEnd();
      }, 150); // debounce for scroll end
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [focusedIndex]);

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
        <h1
          style={{ ...typography.accent, color: colors.yellow }}
          className="upcoming-events-bg"
        >
          Upcoming Events
        </h1>
        <h1
          style={{ ...typography.h1, color: colors.darkblue }}
          className="upcoming-events-fg"
        >
          Upcoming Events
        </h1>
      </div>

      <div className="landing-wrapper">
        <div className="event-carousel" ref={scrollRef}>
          {extendedEvents.map((event, index) => (
>>>>>>> Stashed changes
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
