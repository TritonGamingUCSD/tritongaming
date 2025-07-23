import React, { useRef, useState, useEffect } from 'react';
import './AlternateTitle.css';
import { typography } from '../../styles/typography';
import { colors } from '../../styles/colors';

const AlternateTitle = ({fgTitle, bgTitle}) => {
    return (
        <div className="alternate-title">
            <h1 style={{ ...typography.accent, color: colors.yellow }} className="title-bg">{bgTitle}</h1>
            <h1 style={{ ...typography.h1, color: colors.darkblue }} className="title-fg">{fgTitle}</h1>
        </div>
    );
};

export default AlternateTitle;
