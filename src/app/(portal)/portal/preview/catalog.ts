// Everything the preview pages show. A preview is a page at /portal/preview/<slug> that plays one screen or animation with sample data (nothing is saved, nobody is notified).
// It is not linked from any menu, and only Admins can open /portal/preview to find them all (anyone else gets the page for an address that does not exist). To add one: a line here and a case in PreviewStage.tsx.
export interface Preview {
  slug: string;
  title: string;
  about: string;
  group: 'Codes' | 'Scanning' | 'Site';
}

export const PREVIEWS: Preview[] = [
  { slug: 'bytecode', title: 'Bytecode', about: 'Byte carrying the portal code’s message in his own lines.', group: 'Codes' },
  { slug: 'tgcode', title: 'TGcode', about: 'The circular code that tickets, meetings and rewards show today (kept as it is).', group: 'Codes' },
  {
    slug: 'byte-wink',
    title: 'Byte Wink',
    about: 'The short wink after a good scan: Byte pops up, both his eyes close into happy ^ eyes and a check mark pops out.',
    group: 'Scanning',
  },
  {
    slug: 'code-ring',
    title: 'Code Countdown Ring',
    about: 'The ring that drains round a ticket’s code before it changes: a circle round the TGcode, a line along Byte’s outline round the Bytecode.',
    group: 'Codes',
  },
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
