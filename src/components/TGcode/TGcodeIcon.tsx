// The icon for scanning the portal's circular codes (the Scan button): rings of dashes round a solid middle, with the two marks at the top, instead of the
// standard QR-scanner glyph. Drawn in the current text colour, like the other icons.
export default function TGcodeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="5.6" strokeWidth="1.7" strokeDasharray="3.6 2.6" />
      <circle cx="12" cy="12" r="9.2" strokeWidth="1.7" strokeDasharray="7.2 3.1" />
      <circle cx="6.6" cy="5.6" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="17.4" cy="5.6" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
