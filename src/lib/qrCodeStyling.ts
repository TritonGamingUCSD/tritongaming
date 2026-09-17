// Shared config layer for qr-code-styling, ported from the standalone
// triton-gaming-qrcode tool. Used by both the portal's QR Studio tab (fully
// customizable) and the ticket QR (fixed TG-branded preset).

export type QRIconPreset =
  | 'tg-color'
  | 'tg-minimal'
  | 'link'
  | 'website'
  | 'email'
  | 'phone'
  | 'location'
  | 'wifi'
  | 'none'
  | 'custom';

export type QRDotsType = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type QRCornersSquareType = 'dot' | 'square' | 'extra-rounded';
export type QRCornersDotType = 'dot' | 'square';

export interface QRCodeOptions {
  data: string;
  bgColor: string;
  size: number;
  dotsColor: string;
  dotsGradientEnabled: boolean;
  dotsGradientStartColor: string;
  dotsGradientEndColor: string;
  cornersSquareColor: string;
  cornersDotColor: string;
  dotsType: QRDotsType;
  cornersSquareType: QRCornersSquareType;
  cornersDotType: QRCornersDotType;
  icon: QRIconPreset;
  customIcon: string | null;
  margin: number;
  iconPadding: number;
  transparentBg: boolean;
  downloadFormat: 'png' | 'jpeg';
}

// The Triton Gaming brand logo, already published for the site's other pages.
const TG_LOGO = '/logos/tg_logo.png';

const iconMap: Record<Exclude<QRIconPreset, 'custom'>, string | undefined> = {
  'tg-color': TG_LOGO,
  'tg-minimal': TG_LOGO,
  link: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23002951%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M10%2014L7%2017a3%203%200%201%201-4-4l3-3a3%203%200%200%201%204%200%22/%3E%3Cpath%20d%3D%22M14%2010l3-3a3%203%200%201%201%204%204l-3%203a3%203%200%200%201-4%200%22/%3E%3Cpath%20d%3D%22M8.5%2015.5l7-7%22/%3E%3C/svg%3E',
  website: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23002951%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22/%3E%3Cpath%20d%3D%22M3%2012h18%22/%3E%3Cpath%20d%3D%22M12%203a15%2015%200%200%201%200%2018%22/%3E%3Cpath%20d%3D%22M12%203a15%2015%200%200%200%200%2018%22/%3E%3C/svg%3E',
  email: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23002951%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%226%22%20width%3D%2218%22%20height%3D%2212%22%20rx%3D%222%22/%3E%3Cpath%20d%3D%22M4%208l8%206%208-6%22/%3E%3C/svg%3E',
  phone: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23002951%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M8.8%203h6.4a1.8%201.8%200%200%201%201.8%201.8v14.4a1.8%201.8%200%200%201-1.8%201.8H8.8A1.8%201.8%200%200%201%207%2019.2V4.8A1.8%201.8%200%200%201%208.8%203Z%22/%3E%3Cpath%20d%3D%22M10%206h4%22/%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2217%22%20r%3D%220.8%22%20fill%3D%22%23002951%22%20stroke%3D%22none%22/%3E%3C/svg%3E',
  location: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23002951%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%202a7%207%200%200%201%207%207c0%205-7%2013-7%2013S5%2014%205%209a7%207%200%200%201%207-7Z%22/%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%229%22%20r%3D%222.5%22/%3E%3C/svg%3E',
  wifi: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23002951%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%209a13%2013%200%200%201%2017%200%22/%3E%3Cpath%20d%3D%22M6.5%2012.5a9%209%200%200%201%2011%200%22/%3E%3Cpath%20d%3D%22M9.8%2016a4.2%204.2%200%200%201%204.4%200%22/%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2219%22%20r%3D%221.2%22%20fill%3D%22%23002951%22%20stroke%3D%22none%22/%3E%3C/svg%3E',
  none: undefined,
};

// The original tool's default preset — kept as-is (near-identical to this
// site's own brand colors already) so ticket QR codes and the QR Studio's
// starting point look the same as the standalone tool's "default" output.
export const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  data: 'https://www.example.com',
  size: 500,
  bgColor: '#ffffff',
  dotsColor: '#1e3a8a',
  dotsGradientEnabled: true,
  dotsGradientStartColor: '#8ba7c4',
  dotsGradientEndColor: '#002951',
  cornersSquareColor: '#f59e0b',
  cornersDotColor: '#facc15',
  dotsType: 'extra-rounded',
  cornersSquareType: 'extra-rounded',
  cornersDotType: 'dot',
  icon: 'tg-color',
  customIcon: null,
  margin: 10,
  iconPadding: 6,
  transparentBg: false,
  downloadFormat: 'png',
};

export function getIconSource(options: QRCodeOptions): string | undefined {
  if (options.icon === 'custom') return options.customIcon ?? undefined;
  return iconMap[options.icon];
}

export function getImageSize(icon: QRIconPreset): number {
  if (icon === 'none') return 0;
  if (icon === 'tg-color') return 0.4;
  if (icon === 'tg-minimal') return 0.28;
  if (icon === 'custom') return 0.34;
  return 0.3;
}

export function getDotsGradient(options: QRCodeOptions) {
  if (!options.dotsGradientEnabled) return undefined;
  return {
    type: 'radial' as const,
    colorStops: [
      { offset: 0, color: options.dotsGradientStartColor },
      { offset: 1, color: options.dotsGradientEndColor },
    ],
  };
}

// The shape qr-code-styling's constructor/update() both accept — kept as one
// builder so the initial `new QRCodeStyling(...)` call and every subsequent
// `.update(...)` call stay in sync.
export function buildQRCodeStylingOptions(options: QRCodeOptions) {
  const image = getIconSource(options);
  return {
    width: options.size,
    height: options.size,
    type: 'canvas' as const,
    data: options.data,
    image,
    margin: options.margin,
    qrOptions: {
      mode: 'Byte' as const,
      errorCorrectionLevel: 'H' as const,
    },
    imageOptions: {
      crossOrigin: 'anonymous' as const,
      hideBackgroundDots: true,
      imageSize: getImageSize(options.icon),
      margin: options.iconPadding,
    },
    dotsOptions: {
      color: options.dotsColor,
      type: options.dotsType,
      gradient: getDotsGradient(options),
    },
    backgroundOptions: {
      color: options.transparentBg ? '#00000000' : options.bgColor,
    },
    cornersSquareOptions: {
      type: options.cornersSquareType,
      color: options.cornersSquareColor,
    },
    cornersDotOptions: {
      type: options.cornersDotType,
      color: options.cornersDotColor,
    },
  };
}

