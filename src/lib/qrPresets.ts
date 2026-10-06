import { DEFAULT_QR_OPTIONS, type QRCodeOptions } from '@/lib/qrCodeStyling';

// Ready-made looks for QR Studio — one tap sets colors and shapes (the destination, size, margin,
// center icon and download format stay as the person had them). Light-background presets scan
// everywhere. The ones marked `dark` use a dark background with bright modules for the full gaming
// look — current iPhone and Android cameras read these fine, but some older scanner apps don't.
export type QRPresetStyle = Pick<QRCodeOptions,
  'bgColor' | 'transparentBg' | 'dotsColor' | 'dotsGradientEnabled' | 'dotsGradientStartColor' | 'dotsGradientEndColor' |
  'cornersSquareColor' | 'cornersDotColor' | 'dotsType' | 'cornersSquareType' | 'cornersDotType'>;

// `division`: a keyword matched against division names — picking the preset also drops that
// division's logo in as the center icon.
export interface QRPreset { id: string; name: string; dark?: boolean; division?: string; style: QRPresetStyle }

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
  // The portal's own dark: navy ground, light-blue modules, yellow finder corners, the Triton logo in the middle.
  { id: 'triton-dark', name: 'Triton Night', dark: true, style: base({
    bgColor: '#0b1020', dotsColor: '#a9cdf2', dotsGradientEnabled: true, dotsGradientStartColor: '#a9cdf2', dotsGradientEndColor: '#f2f1f0',
    cornersSquareColor: '#ffc72c', cornersDotColor: '#ffc72c', dotsType: 'extra-rounded', cornersSquareType: 'extra-rounded', cornersDotType: 'dot' }) },
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
  // ── Division looks: colors pulled from each division's logo ──
  { id: 'div-valorant', name: 'Valorant', division: 'valorant', style: base({
    bgColor: '#fffdf5', dotsColor: '#1e3a5f', dotsGradientEnabled: true, dotsGradientStartColor: '#1e3a5f', dotsGradientEndColor: '#0f2747',
    cornersSquareColor: '#b8860b', cornersDotColor: '#1e3a5f', dotsType: 'classy', cornersSquareType: 'square', cornersDotType: 'square' }) },
  { id: 'div-tft', name: 'League of Tritons', dark: true, division: 'league', style: base({
    bgColor: '#06202e', dotsColor: '#22d3ee', dotsGradientEnabled: true, dotsGradientStartColor: '#67e8f9', dotsGradientEndColor: '#facc15',
    cornersSquareColor: '#facc15', cornersDotColor: '#22d3ee', dotsType: 'classy-rounded', cornersSquareType: 'extra-rounded' }) },
  { id: 'div-melee', name: 'Melee', division: 'melee', style: base({
    bgColor: '#faf5ff', dotsColor: '#4f46e5', dotsGradientEnabled: true, dotsGradientStartColor: '#4f46e5', dotsGradientEndColor: '#db2777',
    cornersSquareColor: '#ca8a04', cornersDotColor: '#4f46e5', dotsType: 'extra-rounded' }) },
  { id: 'div-smash', name: 'Smash', division: 'smash', style: base({
    dotsColor: '#000000', cornersSquareColor: '#000000', cornersDotColor: '#000000', dotsType: 'rounded', cornersSquareType: 'dot', cornersDotType: 'dot' }) },
  { id: 'div-pokemon', name: 'Pokémon', division: 'pok', style: base({
    bgColor: '#fffafa', dotsColor: '#1d4ed8', dotsGradientEnabled: true, dotsGradientStartColor: '#1d4ed8', dotsGradientEndColor: '#1e3a8a',
    cornersSquareColor: '#dc2626', cornersDotColor: '#dc2626', dotsType: 'dots', cornersSquareType: 'extra-rounded' }) },
  { id: 'div-mariokart', name: 'Mario Kart', division: 'mario', style: base({
    bgColor: '#fffde7', dotsColor: '#2f4fa8', dotsGradientEnabled: true, dotsGradientStartColor: '#2f4fa8', dotsGradientEndColor: '#7e2a6e',
    cornersSquareColor: '#dc2626', cornersDotColor: '#ca8a04', dotsType: 'rounded', cornersSquareType: 'extra-rounded' }) },
  { id: 'div-splatoon', name: 'Splatoon', division: 'splatoon', style: base({
    bgColor: '#fffaf5', dotsColor: '#ea580c', dotsGradientEnabled: true, dotsGradientStartColor: '#f97316', dotsGradientEndColor: '#db2777',
    cornersSquareColor: '#4d7c0f', cornersDotColor: '#65a30d', dotsType: 'extra-rounded', cornersSquareType: 'extra-rounded' }) },
  { id: 'div-fighters', name: 'Fighters', division: 'fighters', style: base({
    bgColor: '#fffbea', dotsColor: '#1e2a50', cornersSquareColor: '#a77d12', cornersDotColor: '#1e2a50',
    dotsType: 'square', cornersSquareType: 'square', cornersDotType: 'square' }) },
  { id: 'div-rivals', name: 'Rivals', division: 'rivals', style: base({
    bgColor: '#eef0ff', dotsColor: '#1e1b5e', dotsGradientEnabled: true, dotsGradientStartColor: '#1e1b5e', dotsGradientEndColor: '#3730a3',
    cornersSquareColor: '#1e1b5e', cornersDotColor: '#3730a3', dotsType: 'classy', cornersSquareType: 'square', cornersDotType: 'square' }) },
  { id: 'div-tio', name: 'TIO', division: 'intermission', style: base({
    bgColor: '#f7f3ea', dotsColor: '#111111', cornersSquareColor: '#111111', cornersDotColor: '#111111',
    dotsType: 'classy-rounded', cornersSquareType: 'extra-rounded', cornersDotType: 'dot' }) },
];

// Which preset (if any) the current options match — used to highlight the active card.
export function matchingPreset(o: QRCodeOptions): string | null {
  const keys = Object.keys(QR_PRESETS[0].style) as (keyof QRPresetStyle)[];
  const hit = QR_PRESETS.find((p) => keys.every((k) => p.style[k] === o[k]));
  return hit?.id ?? null;
}
