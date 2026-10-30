// The icon for the portal's Bytecode (the Scan button, "Show Bytecode"): Byte's own outline with his two eyes, the pale I and the pale X, the marks a Bytecode is found by. Drawn in the
// current text colour, like the other icons; the TGcode has its own (TGcodeIcon) and CodeIcon picks the one that matches the code being shown. The outline is bold and the shape has a faint
// fill so he reads as a figure even at 16px, and the picture is cropped to his outline so he fills the box.
const OUTLINE =
  'M18.3 10.8L21.1 9.8L21.6 10L21.7 10.6L21.3 11.7L20.6 12.1L21.2 12.3L21.5 12.8L20.6 14.1L20.6 14.7L19.6 15.4L18.8 15.6L18.2 17.2L16.9 19L15.7 19.2L15.7 20.5L15.2 21.4L13.6 21.8L12.7 21.6L12.4 21.2L12 19.7L11.8 20.9L11.3 21.7L9.9 22L8.6 21.5L8.2 20.7L7.9 18.2L7.1 18.3L6.3 17.9L5.6 17.2L5.5 16.2L4.6 16.1L3.5 15.4L3.5 14.7L2.5 13.4L2.8 13L3.5 12.8L2.8 12.4L2.3 10.8L2.9 10.4L4.7 11M18.3 10.8L19.3 9.8L19.5 9.4L18.7 8.5L18.9 7.3L18 6.5L17.1 2.5L16.8 2.2L16.4 2.3L13.7 4.9L13 5.3L12.9 5.2L13.6 4.5L13.7 3.9L12.4 2.3L11.9 2.1L11.5 2.1L10 3.6L9.8 4.5L10.7 5.5L10.1 5.6L9.4 5.3L7.5 3.1L6.8 3.2L6.1 7.1L5.2 7.8L5.3 8.7L4.4 10L4.7 11';

export default function ByteIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0.9 0.9 22.2 22.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={OUTLINE} fill="currentColor" fillOpacity="0.16" stroke="none" />
      <path d={OUTLINE} strokeWidth="1.9" />
      <path d="M9.1 9.2V12.2" strokeWidth="1.8" />
      <path d="M11.5 8.8L14.5 11.8M14.5 8.8L11.5 11.8" strokeWidth="1.6" />
    </svg>
  );
}
