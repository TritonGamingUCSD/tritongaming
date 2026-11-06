// The colors every chart uses, in one place. The categorical order, the blue sequential ramp and the status colors are the validated data-viz palette (adjacent pairs pass the color-blind and
// normal-vision separation checks in both modes); text and gridlines follow the portal's own ink so a chart sits on a card like everything else.
export interface ChartTokens {
  dark: boolean;
  ink: string;
  inkSoft: string;
  inkMute: string;
  grid: string;
  surface: string;
  paper: string;
  series: string[];
  /** One-hue ramp for magnitude, light to dark (the lightest step recedes toward "zero"). */
  seq: string[];
  good: string;
  warn: string;
  bad: string;
}

const CAT_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const CAT_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const SEQ_LIGHT = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const SEQ_DARK = ['#0d366b', '#104281', '#184f95', '#1c5cab', '#2a78d6', '#5598e7', '#9ec5f4'];

/** Reads the current theme from the page (the portal marks it on <html data-pp-theme>) and the container's own colors. */
export function readTokens(el: HTMLElement | null): ChartTokens {
  const dark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-pp-theme') === 'dark';
  const cs = el ? getComputedStyle(el) : null;
  const v = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;
  const ink = v('--pp-ink', dark ? '#f2f1f0' : '#011941');
  return {
    dark,
    ink,
    inkSoft: dark ? 'rgba(242,241,240,0.78)' : 'rgba(1,25,65,0.78)',
    inkMute: dark ? 'rgba(242,241,240,0.55)' : 'rgba(1,25,65,0.55)',
    grid: dark ? 'rgba(242,241,240,0.12)' : 'rgba(1,25,65,0.12)',
    surface: v('--pp-card', dark ? '#1b2540' : '#f3f1ea'),
    paper: v('--pp-paper', dark ? '#131a2b' : '#e9e6df'),
    series: dark ? CAT_DARK : CAT_LIGHT,
    seq: dark ? SEQ_DARK : SEQ_LIGHT,
    good: '#0ca30c',
    warn: '#fab219',
    bad: '#d03b3b',
  };
}

/** The pieces every chart shares: text, a tooltip that looks like the portal's cards, a recessive grid. */
export function baseOption(t: ChartTokens) {
  return {
    textStyle: { color: t.inkSoft, fontFamily: 'inherit' },
    animationDuration: 600,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: t.surface,
      borderColor: t.ink,
      borderWidth: 2,
      padding: [8, 10],
      textStyle: { color: t.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 3px 3px 0 rgba(0,0,0,0.35); border-radius: 6px;',
      axisPointer: { type: 'line' as const, lineStyle: { color: t.inkMute, width: 1 } },
    },
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
  };
}

export const axisStyle = (t: ChartTokens) => ({
  axisLine: { lineStyle: { color: t.grid } },
  axisTick: { show: false },
  axisLabel: { color: t.inkSoft, fontSize: 11 },
  splitLine: { lineStyle: { color: t.grid, type: 'dashed' as const } },
});
