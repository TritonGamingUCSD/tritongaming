import {fontSizes, fontFamilies } from './variables';

export const typography = {
    h1: {
        fontSize: fontSizes.h1,
        fontFamily: fontFamilies.heading1,
        lineHeight: '56px',
    },
    h2: {
        fontSize: fontSizes.h2,
        fontFamily: fontFamilies.heading2,
        lineHeight: '44px',
    },
    h3: {
        fontSize: fontSizes.h3,
        fontFamily: fontFamilies.heading3,
        lineHeight: '32px',
    },
    body: {
        fontSize: fontSizes.body,
        fontFamily: fontFamilies.body,
        lineHeight: '24px',
    },
    accent: {
        fontSize: fontSizes.big,
        fontFamily: fontFamilies.accent,
        lineHeight: '152px',
    },
    caption: {
        fontSize: fontSizes.caption,
        fontFamily: fontFamilies.body,
    }
};