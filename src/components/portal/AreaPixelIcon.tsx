// One small pixel-art icon per area of the sidebar (8 by 8 squares, drawn in the area's color). Navigation only: they stand where a plain dot used to be.
const ART: Record<string, string[]> = {
  Yours: ['..####..', '.######.', '.######.', '..####..', '...##...', '.######.', '########', '########'],
  Events: ['.#....#.', '########', '#......#', '#.##.#.#', '#......#', '#.#.##.#', '#......#', '########'],
  Run: ['########', '#......#', '#.#..#.#', '#.##.#.#', '#.#..#.#', '#......#', '########', '..####..'],
  Team: ['.##..##.', '.##..##.', '..#..#..', '####.###', '####.###', '.##..##.', '.##..##.', '.##..##.'],
  Outreach: ['......##', '....####', '#######.', '#######.', '#######.', '....####', '.....#..', '.....##.'],
  Admin: ['...##...', '.######.', '########', '###..###', '###..###', '########', '.######.', '...##...'],
};

export default function AreaPixelIcon({ group, size = 16 }: { group: string; size?: number }) {
  const rows = ART[group];
  if (!rows) return null;
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" fill="currentColor">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}
