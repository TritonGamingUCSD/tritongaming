// Deliberately independent of the 'ucsd' role in user_roles. That role is a
// badge auto-granted at signup for general use (nav, future gates); ticket
// pricing/audience checks stay on the live session email so they can't drift
// from a stale role row (an email change, or a manual admin edit elsewhere).
export function isUcsdEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith('@ucsd.edu');
}
