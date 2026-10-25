// "Fetch everything again, and stay where I am". The refresh button, the pull-down gesture and coming back to the app after a while all end here. The portal hub (PortalHub.tsx) listens: it asks
// the server for the page's data again and then rebuilds the open section, so what was changed (a check-in, an event, a device) shows without leaving the page or closing the app.
export const REFRESH_EVENT = 'tg:portal-refresh';
export const REFRESHED_EVENT = 'tg:portal-refreshed';
export const refreshPortal = () => window.dispatchEvent(new Event(REFRESH_EVENT));
