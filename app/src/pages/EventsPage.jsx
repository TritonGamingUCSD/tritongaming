import React, { useState, useEffect } from 'react';
import './EventsPage.css';
import AlternateTitle from '../components/AlternateTitle/AlternateTitle';
import LongEventCard from '../components/LongEventCard/LongEventCard';

const EventsPage = () => {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [previousEvents, setPreviousEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const upcoming = await fetch('https://tritongaming.onrender.com/api/events/upcoming');
        const previous = await fetch('https://tritongaming.onrender.com/api/events/previous');
        const data1 = await upcoming.json();
        const data2 = await previous.json();
        if (Array.isArray(data1.events)) {
          setUpcomingEvents(data1.events);
        }
        if (Array.isArray(data2.events)) {
          setPreviousEvents(data2.events);
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    };

    fetchEvents();
  }, []);

    return (
        <div className="events">
            <AlternateTitle fgTitle="Upcoming Events" bgTitle="Upcoming Events" />
            {upcomingEvents.map((event, index) => (
              <LongEventCard key={index} event={event} />
              
            ))}
            <AlternateTitle fgTitle="Previous Events" bgTitle="Previous Events" />
            {previousEvents.map((event, index) => (
              <LongEventCard key={index} event={event} />
            ))}
        </div>
    );
};

export default EventsPage;
