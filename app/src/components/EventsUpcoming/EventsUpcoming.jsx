import React, { useRef, useState, useEffect } from 'react';
import './EventsUpcoming.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';
import AlternateTitle from '../AlternateTitle/AlternateTitle';

const EventsUpcoming = () => {
    return (
        <div className="upcoming-events">
            <AlternateTitle fgTitle="Upcoming Events" bgTitle="Upcoming Events" />
        </div>
    );
};

export default EventsUpcoming;