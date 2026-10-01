import { DEFAULT_QR_OPTIONS, type QRCodeOptions } from '@/lib/qrCodeStyling';

// Ready-made looks for QR Studio — one tap sets colors and shapes (the destination, size, margin,
// center icon and download format stay as the person had them). Light-background presets scan
// everywhere. The ones marked `dark` use a dark background with bright modules for the full gaming
// look — current iPhone and Android cameras read these fine, but some older scanner apps don't.
export type QRPresetStyle = Pick<QRCodeOptions,
  'bgColor' | 'transparentBg' | 'dotsColor' | 'dotsGradientEnabled' | 'dotsGradientStartColor' | 'dotsGradientEndColor' |
  'cornersSquareColor' | 'cornersDotColor' | 'dotsType' | 'cornersSquareType' | 'cornersDotType'>;

export interface QRPreset { id: string; name: string; dark?: boolean; style: QRPresetStyle }

const base = (s: Partial<QRPresetStyle>): QRPresetStyle => ({
  bgColor: '#ffffff', transparentBg: false,
  dotsColor: '#111827', dotsGradientEnabled: false, dotsGradientStartColor: '#111827', dotsGradientEndColor: '#111827',
  cornersSquareColor: '#111827', cornersDotColor: '#111827',
  dotsType: 'rounded', cornersSquareType: 'extra-rounded', cornersDotType: 'dot',
  ...s,
});

export const QR_PRESETS: QRPreset[] = [
  { id: 'triton', name: 'Triton', style: base({
    dotsColor: DEFAULT_QR_OPTIONS.dotsColor, dotsGradientEnabled: true, dotsGradientStartColor: DEFAULT_QR_OPTIONS.dotsGradientStartColor, dotsGradientEndColor: DEFAULT_QR_OPTIONS.dotsGradientEndColor,
    cornersSquareColor: DEFAULT_QR_OPTIONS.cornersSquareColor, cornersDotColor: DEFAULT_QR_OPTIONS.cornersDotColor, dotsType: 'extra-rounded' }) },
  { id: 'neon-arcade', name: 'Neon Arcade', dark: true, style: base({
    bgColor: '#0b1020', dotsColor: '#22d3ee', dotsGradientEnabled: true, dotsGradientStartColor: '#22d3ee', dotsGradientEndColor: '#a855f7',
    cornersSquareColor: '#f472b6', cornersDotColor: '#22d3ee', dotsType: 'dots', cornersSquareType: 'extra-rounded' }) },
  { id: 'synthwave', name: 'Synthwave', dark: true, style: base({
    bgColor: '#1a0b2e', dotsColor: '#f0abfc', dotsGradientEnabled: true, dotsGradientStartColor: '#f472b6', dotsGradientEndColor: '#38bdf8',
    cornersSquareColor: '#fb923c', cornersDotColor: '#f472b6', dotsType: 'classy-rounded', cornersSquareType: 'extra-rounded' }) },
  { id: 'toxic', name: 'Toxic', dark: true, style: base({
    bgColor: '#07110a', dotsColor: '#4ade80', dotsGradientEnabled: true, dotsGradientStartColor: '#bef264', dotsGradientEndColor: '#22c55e',
    cornersSquareColor: '#bef264', cornersDotColor: '#4ade80', dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'square' }) },
  { id: 'pixel-quest', name: 'Pixel Quest', style: base({
    bgColor: '#f7fee7', dotsColor: '#166534', cornersSquareColor: '#92400e', cornersDotColor: '#ca8a04',
    dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'square' }) },
  { id: 'boss-fight', name: 'Boss Fight', style: base({
    dotsColor: '#991b1b', dotsGradientEnabled: true, dotsGradientStartColor: '#dc2626', dotsGradientEndColor: '#450a0a',
    cornersSquareColor: '#111827', cornersDotColor: '#ef4444', dotsType: 'classy', cornersSquareType: 'square', cornersDotType: 'square' }) },
  { id: 'cyber', name: 'Cyberpunk', style: base({
    bgColor: '#fffbe6', dotsColor: '#1e1b4b', dotsGradientEnabled: true, dotsGradientStartColor: '#1e1b4b', dotsGradientEndColor: '#7c3aed',
    cornersSquareColor: '#db2777', cornersDotColor: '#111827', dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'dot' }) },
  { id: 'frostbite', name: 'Frostbite', style: base({
    bgColor: '#f0f9ff', dotsColor: '#0c4a6e', dotsGradientEnabled: true, dotsGradientStartColor: '#0ea5e9', dotsGradientEndColor: '#1e3a8a',
    cornersSquareColor: '#0369a1', cornersDotColor: '#38bdf8', dotsType: 'extra-rounded' }) },
  { id: 'gold-loot', name: 'Gold Loot', style: base({
    bgColor: '#fffbeb', dotsColor: '#92400e', dotsGradientEnabled: true, dotsGradientStartColor: '#b45309', dotsGradientEndColor: '#78350f',
    cornersSquareColor: '#f59e0b', cornersDotColor: '#facc15', dotsType: 'extra-rounded' }) },
  { id: 'mono', name: 'Mono', style: base({ dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'square' }) },
];

// Which preset (if any) the current options match — used to highlight the active card.
export function matchingPreset(o: QRCodeOptions): string | null {
  const keys = Object.keys(QR_PRESETS[0].style) as (keyof QRPresetStyle)[];
  const hit = QR_PRESETS.find((p) => keys.every((k) => p.style[k] === o[k]));
  return hit?.id ?? null;
}
