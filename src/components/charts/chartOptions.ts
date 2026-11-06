import type { EChartsCoreOption } from 'echarts/core';
import { axisStyle, baseOption, type ChartTokens } from './chartTheme';

// Option builders for every chart shape the portal uses. Each takes the theme's colors and plain data and returns an ECharts option; screens never write ECharts options by hand.
// Marks are thin, bars have a 4px rounded data end and a 2px surface gap, grids are recessive, and a number is only printed where it helps (the end of a bar, the last point of a line).

const fmt = (n: number) => n.toLocaleString();

/** A smooth line with a soft area under it (a total over time). */
export function areaLine(t: ChartTokens, o: { x: string[]; y: number[]; name: string; color?: string; max?: number }): EChartsCoreOption {
  const color = o.color ?? t.series[0];
  return {
    ...baseOption(t),
    xAxis: { type: 'category', data: o.x, boundaryGap: false, ...axisStyle(t), splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, max: o.max, min: 0, ...axisStyle(t) },
    series: [
      {
        name: o.name,
        type: 'line',
        data: o.y,
        smooth: o.max ? 0.15 : 0.3,
        smoothMonotone: 'x',
        showSymbol: false,
        lineStyle: { width: 2.5, color },
        itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}55` },
              { offset: 1, color: `${color}05` },
            ],
          },
        },
        emphasis: { focus: 'series' },
        endLabel: { show: true, formatter: (p: { value: number }) => fmt(p.value), color: t.ink, fontWeight: 700, fontSize: 12 },
      },
    ],
  } as EChartsCoreOption;
}

/** Bars side by side for a few series over categories (sign-ups and check-ins each month). */
export function groupedBars(t: ChartTokens, o: { x: string[]; series: { name: string; data: number[] }[]; unit?: string }): EChartsCoreOption {
  return {
    ...baseOption(t),
    legend: o.series.length > 1 ? { top: 0, right: 0, textStyle: { color: t.inkSoft, fontSize: 12 }, icon: 'roundRect', itemWidth: 12, itemHeight: 8 } : undefined,
    xAxis: { type: 'category', data: o.x, ...axisStyle(t), splitLine: { show: false } },
    yAxis: { type: 'value', minInterval: 1, ...axisStyle(t) },
    series: o.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      barMaxWidth: 26,
      itemStyle: { color: t.series[i], borderColor: t.surface, borderWidth: 2, borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' },
    })),
  } as EChartsCoreOption;
}

/** Ranked horizontal bars with the number at the end of each (division sizes, events by turnout). */
export function rankedBars(t: ChartTokens, o: { labels: string[]; values: number[]; unit?: string; color?: string; max?: number }): EChartsCoreOption {
  const color = o.color ?? t.series[0];
  return {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'item' },
    grid: { left: 8, right: 44, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', max: o.max, minInterval: 1, ...axisStyle(t), axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: 'category',
      data: o.labels,
      inverse: true,
      ...axisStyle(t),
      splitLine: { show: false },
      axisLabel: { color: t.ink, fontSize: 12, width: 130, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: o.values,
        barMaxWidth: 20,
        itemStyle: { color, borderColor: t.surface, borderWidth: 2, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', color: t.ink, fontWeight: 700, fontSize: 12, formatter: (p: { value: number }) => `${fmt(p.value)}${o.unit ?? ''}` },
      },
    ],
  } as EChartsCoreOption;
}

/** Weekday by hour: how busy each slot is (check-ins). `data` is [hour, weekdayIndex (0 = Monday), count]. */
export function weekdayHour(t: ChartTokens, o: { data: [number, number, number][]; hours: number[] }): EChartsCoreOption {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
  const max = Math.max(1, ...o.data.map((d) => d[2]));
  return {
    ...baseOption(t),
    tooltip: {
      ...baseOption(t).tooltip,
      trigger: 'item',
      formatter: (p: { value: [number, number, number] }) => `${days[p.value[1]]} ${label(o.hours[p.value[0]])}: <b>${p.value[2]}</b> check-ins`,
    },
    grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: o.hours.map(label), splitArea: { show: false }, ...axisStyle(t), splitLine: { show: false } },
    yAxis: { type: 'category', data: days, inverse: true, ...axisStyle(t), splitLine: { show: false } },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 120,
      text: ['More', 'Fewer'],
      textStyle: { color: t.inkSoft, fontSize: 11 },
      inRange: { color: [t.seq[0], ...t.seq.slice(1)] },
    },
    series: [{ type: 'heatmap', data: o.data, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: t.ink } } }],
  } as EChartsCoreOption;
}

/** A year of days, darker where more happened. `data` is [YYYY-MM-DD, count]. */
export function calendarHeat(t: ChartTokens, o: { from: string; to: string; data: [string, number][]; what: string }): EChartsCoreOption {
  const max = Math.max(1, ...o.data.map((d) => d[1]));
  return {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'item', formatter: (p: { value: [string, number] }) => `${p.value[0]}: <b>${p.value[1]}</b> ${o.what}` },
    visualMap: { min: 0, max, show: false, inRange: { color: [t.seq[0], ...t.seq.slice(1)] } },
    calendar: {
      range: [o.from, o.to],
      cellSize: ['auto', 14],
      top: 24,
      left: 28,
      right: 8,
      itemStyle: { color: t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(1,25,65,0.05)', borderColor: t.surface, borderWidth: 2 },
      splitLine: { show: false },
      yearLabel: { show: false },
      monthLabel: { color: t.inkSoft, fontSize: 11 },
      dayLabel: { color: t.inkSoft, fontSize: 10, firstDay: 1, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: o.data.filter((d) => d[1] > 0), itemStyle: { borderRadius: 3 } }],
  } as EChartsCoreOption;
}

/** A cohort grid: rows are the month people first came, columns are months since, and each cell is the share who came back. `data` is [col, row, percent]. */
export function cohortGrid(t: ChartTokens, o: { rows: string[]; cols: string[]; data: [number, number, number][] }): EChartsCoreOption {
  return {
    ...baseOption(t),
    tooltip: {
      ...baseOption(t).tooltip,
      trigger: 'item',
      formatter: (p: { value: [number, number, number] }) => `${o.rows[p.value[1]]}, ${o.cols[p.value[0]]}: <b>${p.value[2]}%</b> came`,
    },
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: o.cols, position: 'top', ...axisStyle(t), splitLine: { show: false } },
    yAxis: { type: 'category', data: o.rows, inverse: true, ...axisStyle(t), splitLine: { show: false } },
    visualMap: { min: 0, max: 100, show: false, inRange: { color: [t.seq[0], ...t.seq.slice(1)] } },
    series: [
      {
        type: 'heatmap',
        // text turns white on the dark cells (and dark on the light ones) so every number reads
        data: o.data.map((d) => ({ value: d, label: { color: t.dark ? (d[2] >= 60 ? '#0b1220' : '#ffffff') : d[2] >= 45 ? '#ffffff' : t.ink } })),
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
        label: { show: true, formatter: (p: { value: [number, number, number] }) => `${p.value[2]}%`, fontSize: 11, fontWeight: 700 },
      },
    ],
  } as EChartsCoreOption;
}

/** Stages narrowing down (registered, came, came back). Ordinal ramp from the sequential hue. */
export function funnel(t: ChartTokens, o: { steps: { name: string; value: number }[] }): EChartsCoreOption {
  const ramp = t.dark ? [t.seq[3], t.seq[4], t.seq[5]] : [t.seq[2], t.seq[4], t.seq[5]];
  return {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'item', formatter: '{b}: <b>{c}</b>' },
    series: [
      {
        type: 'funnel',
        left: '8%',
        right: '8%',
        top: 8,
        bottom: 8,
        minSize: '18%',
        gap: 3,
        sort: 'none',
        data: o.steps.map((s, i) => ({ ...s, itemStyle: { color: ramp[i % ramp.length], borderColor: t.surface, borderWidth: 2 } })),
        label: { show: true, position: 'inside', color: '#fff', fontWeight: 700, fontSize: 13, formatter: (p: { name: string; value: number }) => `${p.name}  ${fmt(p.value)}` },
      },
    ],
  } as EChartsCoreOption;
}

/** A ring split into a few parts (new and returning people, tiers). Slots in fixed order, a 2px gap between parts. */
export function donut(t: ChartTokens, o: { items: { name: string; value: number }[]; centre?: string }): EChartsCoreOption {
  return {
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)' },
    legend: { bottom: 0, textStyle: { color: t.inkSoft, fontSize: 12 }, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
    graphic: o.centre ? [{ type: 'text', left: 'center', top: '38%', style: { text: o.centre, fill: t.ink, fontSize: 22, fontWeight: 800, textAlign: 'center' } }] : undefined,
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
        data: o.items.map((d, i) => ({ ...d, itemStyle: { color: t.series[i % t.series.length] } })),
      },
    ],
  } as EChartsCoreOption;
}
