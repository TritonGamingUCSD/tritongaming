/**
 * Shared TypeScript types for venues and schedule data.
 * Matches the shape of src/data/venues.json and src/data/schedule.json.
 */

/** A sub-room within a venue (e.g. "Ballroom Stage" inside "East Ballroom"). */
export interface Room {
  id: string;
  name: string;
}

/**
 * A top-level venue location.
 * If `rooms` is empty the venue itself acts as a single schedule column.
 *
 * color must be one of: teal | magenta | yellow | orange | purple | indigo | pink
 */
export interface Venue {
  id: string;
  name: string;
  color: string;
  rooms: Room[];
}

/**
 * A single scheduled event.
 *
 * roomId must match either:
 *   - a Venue.id  (for venues that have no sub-rooms), or
 *   - a Room.id   nested inside a Venue.
 *
 * Times are 24-hour "HH:MM" and must land on :00, :15, :30, or :45.
 * Valid range is 12:00 – 20:00.
 *
 * Example:
 * {
 *   "id": "opening-ceremony",
 *   "title": "Opening Ceremony",
 *   "roomId": "west-stage",
 *   "startTime": "12:00",
 *   "endTime": "13:00",
 *   "type": "Ceremony",
 *   "description": "Welcome to TGEX 2026!"
 * }
 */
export interface ScheduleEvent {
  id: string;
  title: string;
  roomId: string;
  startTime: string; // "HH:MM" 24-hour, e.g. "13:00"
  endTime: string;   // "HH:MM" 24-hour, e.g. "14:30"
  type?: string;
  description?: string;
  /** Live stream URL (e.g. Twitch channel) for this event */
  streamUrl?: string;
  /** Link to a blurb, Instagram post, or event detail page */
  link?: string;
}

/** One convention day with its list of events. */
export interface ScheduleDay {
  date: string;  // "YYYY-MM-DD"
  label: string; // Display text, e.g. "Day 1 — Sat, May 30"
  events: ScheduleEvent[];
}

export interface Schedule {
  days: ScheduleDay[];
}
