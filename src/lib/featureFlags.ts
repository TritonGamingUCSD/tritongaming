// Switches for features that are built but not live. Flip to true to turn one on (nothing else needs to change).

// Optional, view-only linking of a member's own Google Calendar(s): shows their events on their portal calendar and as a hint when planning
// meetings. Paused: while false, the Sync panel doesn't offer it, the API routes refuse, and nothing is ever fetched from Google. The code,
// the tests and the database table stay in place. Before turning it on, set the Google env vars (see README, "Linking Google Calendar").
export const GOOGLE_CALENDAR_LINKING = false;
