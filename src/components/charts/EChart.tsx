'use client';

import { useEffect, useRef } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { readTokens, type ChartTokens } from './chartTheme';

interface Instance {
  setOption: (o: EChartsCoreOption, notMerge?: boolean) => void;
  resize: () => void;
  dispose: () => void;
}

// One chart. `build` turns the current theme's colors into an ECharts option; the chart is drawn again when the data changes and when the portal switches between light and dark, and it resizes with its box.
// ECharts itself is loaded the first time a chart appears (never on the server, never on pages without charts).
export default function EChart({ build, height = 260, label }: { build: (t: ChartTokens) => EChartsCoreOption; height?: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<Instance | null>(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  const draw = () => chart.current?.setOption(buildRef.current(readTokens(box.current)), true);

  useEffect(() => {
    let disposed = false;
    void import('./echartsCore').then(({ default: echarts }) => {
      if (disposed || !box.current) return;
      chart.current = echarts.init(box.current, undefined, { renderer: 'canvas' }) as Instance;
      draw();
    });
    const ro = new ResizeObserver(() => chart.current?.resize());
    if (box.current) ro.observe(box.current);
    const mo = new MutationObserver(() => draw());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-pp-theme'] });
    return () => {
      disposed = true;
      ro.disconnect();
      mo.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every render of the parent passes a fresh `build`: draw again with the new data.
  useEffect(() => {
    draw();
  });

  return <div ref={box} role="img" aria-label={label} style={{ width: '100%', height }} />;
}
