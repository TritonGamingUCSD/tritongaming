'use client';

import Button from '@/components/ui/Button';
import { useSiteSettings } from '@/components/portal/SiteSettingsProvider';
import { setCodeStyle, useDeviceCodeStyle, type CodeStyle } from '@/lib/ui/useCodeStyle';
import styles from './preview.module.css';

// Chooses which code THIS device draws for the person's own ticket, meeting code and reward pickup (kept in this browser only; nobody else is affected, and the Scan page reads both). "Follow The Site"
// goes back to what the Admins chose for everyone (Admin → System → Settings).
export default function CodeStyleSwitch() {
  const own = useDeviceCodeStyle();
  const site = useSiteSettings().codeStyle;
  const name = (s: CodeStyle) => (s === 'byte' ? 'a Bytecode (Byte)' : s === 'qr' ? 'a QR code' : 'a TGcode');
  return (
    <section className={styles.switch} aria-label="Code style on this device">
      <div>
        <strong>My Codes On This Device</strong>
        <p className={styles.note}>
          {own
            ? `This device shows your own ticket, meeting code and reward pickup as ${name(own)}.`
            : `This device follows the site: everyone's codes are ${name(site)} right now.`}{' '}
          Your choice applies on this phone or laptop only, and the Scan page reads all of them.
        </p>
      </div>
      <div className={styles.bar}>
        <Button variant={own === null ? 'primary' : 'secondary'} onClick={() => setCodeStyle('site')} aria-pressed={own === null}>
          Follow The Site
        </Button>
        <Button variant={own === 'tg' ? 'primary' : 'secondary'} onClick={() => setCodeStyle('tg')} aria-pressed={own === 'tg'}>
          TGcode
        </Button>
        <Button variant={own === 'byte' ? 'primary' : 'secondary'} onClick={() => setCodeStyle('byte')} aria-pressed={own === 'byte'}>
          Bytecode
        </Button>
        <Button variant={own === 'qr' ? 'primary' : 'secondary'} onClick={() => setCodeStyle('qr')} aria-pressed={own === 'qr'}>
          QR Code
        </Button>
      </div>
    </section>
  );
}
