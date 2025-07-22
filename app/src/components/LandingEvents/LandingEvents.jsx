import React, { useRef, useState, useEffect } from 'react';
import EventCard from '../EventCard/EventCard';
import events from '../../data/events';
import './LandingEvents.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

const ITEMS_TO_CLONE = 2;

const LandingEvents = () => {
  const scrollRef = useRef(null);
  const cardRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(null);

  const extendedEvents = [
    ...events.slice(-ITEMS_TO_CLONE), // Clone last N at the beginning
    ...events,
    ...events.slice(0, ITEMS_TO_CLONE), // Clone first N at the end
  ];

  const realEventStartIndex = ITEMS_TO_CLONE;

  const scrollToIndex = (index) => {
    const container = scrollRef.current;
    const card = cardRefs.current[index];
    if (container && card) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.left - containerRect.left - (container.offsetWidth / 2) + (card.offsetWidth / 2);
      container.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleFocus = (index) => {
    setFocusedIndex(index - ITEMS_TO_CLONE); // Adjusting for fake head
    scrollToIndex(index);
  };

  const handleScrollEnd = () => {
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;

    const totalWidth = container.scrollWidth;
    const containerWidth = container.offsetWidth;
    const threshold = containerWidth * 0.5;

    if (scrollLeft < threshold) {
      // Scrolled too far left → jump to real end
      const newIndex = events.length + ITEMS_TO_CLONE - 1;
      scrollToFakeIndexImmediately(newIndex);
    } else if (scrollLeft + containerWidth > totalWidth - threshold) {
      // Scrolled too far right → jump to real start
      const newIndex = ITEMS_TO_CLONE;
      scrollToFakeIndexImmediately(newIndex);
    }
  };

  const scrollToFakeIndexImmediately = (index) => {
    const container = scrollRef.current;
    const card = cardRefs.current[index];
    if (container && card) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const offset = cardRect.left - containerRect.left - (container.offsetWidth / 2) + (card.offsetWidth / 2);
      container.scrollLeft += offset;
    }
  };

  useEffect(() => {
    // Jump to the first real event (skip clones)
    scrollToFakeIndexImmediately(ITEMS_TO_CLONE);
    setFocusedIndex(0);
  }, []);

  return (
    <div className="landing-events">
      <div className="title-upcoming-events">
        <h1 style={{ ...typography.accent, color: colors.yellow }} className="upcoming-events-bg">Upcoming Events</h1>
        <h1 style={{ ...typography.h1, color: colors.darkblue }} className="upcoming-events-fg">Upcoming Events</h1>
      </div>
      <div className="landing-wrapper">
        <div
          className="event-carousel"
          ref={scrollRef}
          onScroll={() => {
            clearTimeout(scrollRef.current.scrollTimeout);
            scrollRef.current.scrollTimeout = setTimeout(() => {
              handleScrollEnd();
            }, 100); // debounce
          }}
        >
          {extendedEvents.map((event, index) => (
            <div
              key={index}
              ref={(el) => (cardRefs.current[index] = el)}
              onClick={() => handleFocus(index)}
              className={`event-card-wrapper ${focusedIndex + ITEMS_TO_CLONE !== index ? 'faded' : ''}`}
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
