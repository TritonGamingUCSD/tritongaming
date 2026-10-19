import { useId } from 'react';

// The icon for the portal's circular codes (the Scan button, "Show TGcode"): a small TGcode. Two rings of rounded arcs of different lengths with the same small gap between
// them, a solid middle, the two ring marks at the top and a dot at each bottom corner (the arcs stop short of the marks, as they do in the code). Drawn in the current
// text colour, like the other icons.
const MARKS = [[6.3, 6.2], [17.7, 6.2]] as const;
const DOTS = [[6.3, 17.8], [17.7, 17.8]] as const;

export default function TGcodeIcon({ size = 24 }: { size?: number }) {
  const id = `tg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24" stroke="none">
        <rect width="24" height="24" fill="white" />
        {[...MARKS, ...DOTS].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.1" fill="black" />)}
      </mask>
      <g mask={`url(#${id})`} strokeWidth="1.8">
        <circle cx="12" cy="12" r="5" strokeDasharray="8 2 4.5 2 6.5 2 4.4 2" transform="rotate(-90 12 12)" />
        <circle cx="12" cy="12" r="8.6" strokeDasharray="12 2 7 2 9.5 2 6.5 2 9.04 2" transform="rotate(-90 12 12)" />
      </g>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      {MARKS.map(([x, y]) => (
        <g key={`m${x}`}>
          <circle cx={x} cy={y} r="1" fill="currentColor" stroke="none" />
          <circle cx={x} cy={y} r="2.1" strokeWidth="0.9" />
        </g>
      ))}
      {DOTS.map(([x, y]) => <circle key={`d${x}`} cx={x} cy={y} r="1" fill="currentColor" stroke="none" />)}
    </svg>
  );
}
