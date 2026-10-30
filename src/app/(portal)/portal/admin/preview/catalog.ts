// Everything the preview pages show. A preview is a page at /portal/admin/preview/<slug> that plays one screen or animation with sample data (nothing is saved, nobody is notified).
// Only Admins see them: the list is Admin › System › Previews (/portal/admin/preview) and a page for anyone else is the one for an address that does not exist. To add one: a line here and a case in PreviewStage.tsx.
export interface Preview {
  slug: string;
  title: string;
  about: string;
  group: 'Codes' | 'Scanning' | 'Site';
}

export const PREVIEWS: Preview[] = [
  { slug: 'codes', title: 'Codes', about: 'The TGcode, the Bytecode and the QR code side by side, light and dark, with one sample you can change.', group: 'Codes' },
  {
    slug: 'byte-wink',
    title: 'Byte Wink',
    about: 'The short wink after a good scan: Byte pops up, both his eyes close into happy ^ eyes and a check mark pops out.',
    group: 'Scanning',
  },
  {
    slug: 'code-ring',
    title: 'Code Countdown Ring',
    about: 'The time left on a ticket’s code: a ring that drains round the TGcode, a line that shortens under the Bytecode.',
    group: 'Codes',
  },
  { slug: 'byte-poses', title: 'Byte Poses', about: 'The small Byte used for loading, empty lists and the 404 page: awake and blinking, asleep, lost, happy.', group: 'Site' },
  { slug: 'scan-test', title: 'Test Scan', about: 'The real camera and reader as a dry run: it says what it read and plays the animation, and sends nothing.', group: 'Scanning' },
  { slug: 'scan-opening', title: 'Scan Opening', about: 'The black screen that shows the moment the Scan button is pressed, until the camera is ready.', group: 'Scanning' },
  { slug: 'check-in-results', title: 'Check-In Results', about: 'What the scanner shows after a scan: meeting, ticket, reward and the questions it can ask.', group: 'Scanning' },
  {
    slug: 'ticket-checked-in',
    title: 'Ticket Checked In',
    about: 'The screen a person sees on their own phone once staff scan their ticket, with points and a tier-up.',
    group: 'Scanning',
  },
  { slug: 'site-animations', title: 'Site Animations', about: 'The shared motion of the site: logo pop, float, glow, shimmer, aurora, spinners.', group: 'Site' },
];
