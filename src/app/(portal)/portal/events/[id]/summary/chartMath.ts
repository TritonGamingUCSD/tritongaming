// Axis maths shared by the on-screen charts and the PDF ones: round the top of the axis up to a "nice" number so the gridlines land on 0, 10, 20 and so on.
export function niceScale(max: number, target = 4): { top: number; ticks: number[] } {
  const m = Math.max(target, max);
  const rough = m / target;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  // Whole numbers only: these axes count people and tickets.
  const step = Math.max(1, [1, 2, 5, 10].map((k) => k * pow).find((x) => x >= rough) ?? pow * 10);
  const top = Math.ceil(m / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

// A bar's label on two short lines instead of one long one that would shrink or collide ("12:00 AM" becomes "12:00" over "AM").
export function twoLines(label: string): [string, string] {
  if (label.length <= 7 || !label.includes(' ')) return [label, ''];
  const mid = label.length / 2;
  let best = -1;
  label.split('').forEach((ch, i) => {
    if (ch === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  });
  return [label.slice(0, best), label.slice(best + 1)];
}
