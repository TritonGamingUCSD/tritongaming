// Naming the devices that have notifications on, from the browser string saved when each was turned on ("iPhone · TG Portal app · iOS 18.7"),
// so a member can tell their devices apart. Pure text work, safe in the browser and on the server.

export function describeDevice(ua: string | null | undefined): string {
  const s = ua ?? '';
  const ios = /iPhone|iPad|iPod/.exec(s)?.[0];
  const android = /Android/.test(s);
  let device = 'Unknown device';
  let version = '';
  if (ios) {
    device = ios === 'iPod' ? 'iPod' : ios;
    const v = /OS (\d+)[_.](\d+)/.exec(s);
    if (v) version = `iOS ${v[1]}.${v[2]}`;
  } else if (android) {
    const v = /Android ([\d.]+)/.exec(s)?.[1];
    if (v) version = `Android ${v.split('.')[0]}`;
    const model = /Android [\d.]+; ([^;)]+?)(?: Build|[;)])/.exec(s)?.[1]?.trim();
    device = `${/Mobile/.test(s) ? 'Android phone' : 'Android tablet'}${model && model !== 'K' ? ` (${model})` : ''}`;
  } else if (/Windows/.test(s)) device = 'Windows computer';
  else if (/Macintosh|Mac OS X/.test(s)) device = 'Mac';
  else if (/CrOS/.test(s)) device = 'Chromebook';
  else if (/Linux/.test(s)) device = 'Linux computer';

  // On iPhone and iPad, a site opened from the Home Screen has no "Safari" in its browser string.
  const app = ios && !/Safari\//.test(s);
  const browser = app
    ? 'TG Portal app'
    : /EdgiOS|Edg\//.test(s)
      ? 'Edge'
      : /OPR\/|OPiOS/.test(s)
        ? 'Opera'
        : /SamsungBrowser/.test(s)
          ? 'Samsung Internet'
          : /FxiOS|Firefox\//.test(s)
            ? 'Firefox'
            : /CriOS|Chrome\//.test(s)
              ? 'Chrome'
              : /Safari\//.test(s)
                ? 'Safari'
                : '';
  return [device, browser, version].filter(Boolean).join(' · ');
}

// A short stable id for a subscription address, so this browser can tell which listed device is itself without the address being sent anywhere.
export async function endpointFingerprint(endpoint: string): Promise<string> {
  const bytes = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
