import React, { useRef, useState, useEffect } from 'react';
import './EventsUpcoming.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import AlternateTitle from '../AlternateTitle/AlternateTitle';
import LongEventCard from '../LongEventCard/LongEventCard';

const EventsUpcoming = () => {

  const [upcomingEvents, setUpcomingEvents] = useState([]);

  //fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('https://tritongaming.onrender.com/api/events/upcoming');
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setUpcomingEvents(data.events);
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    };

    fetchEvents();
  }, []);

    return (
        <div className="upcoming-events">
            <AlternateTitle fgTitle="Upcoming Events" bgTitle="Upcoming Events" />
            {upcomingEvents.length > 0 && (
              <LongEventCard event={upcomingEvents[0]} />
            )}
        </div>
    );
};

export default EventsUpcoming;
