'use client';

import Button from '@/components/ui/Button';
import { useSiteSettings } from '@/components/portal/SiteSettingsProvider';
import { CODE_STYLE_NAMES, CODE_USES, CODE_USE_NAMES, styleFor, type CodeStyle, type CodeUse } from '@/lib/portal/siteSettings';
import { setCodeStyle, useDeviceCodeStyle } from '@/lib/ui/useCodeStyle';
import styles from './preview.module.css';

const STYLES: CodeStyle[] = ['tg', 'byte', 'qr'];

// Chooses which code THIS device draws for each of the person's own codes (kept in this browser only; nobody else is affected, and the Scan page reads all of them). "Follow The Site" goes back to what the
// Admins chose (Admin → System → Settings).
export default function CodeStyleSwitch() {
  return (
    <section className={styles.switch} aria-label="Code style on this device">
      <div>
        <strong>My Codes On This Device</strong>
        <p className={styles.note}>Your choices apply on this phone or laptop only, and the Scan page reads all of them.</p>
      </div>
      {CODE_USES.map((use) => (
        <UseRow key={use} use={use} />
      ))}
    </section>
  );
}

function UseRow({ use }: { use: CodeUse }) {
  const own = useDeviceCodeStyle(use);
  const site = styleFor(useSiteSettings(), use);
  return (
    <div className={styles.useRow}>
      <span>
        <strong>{CODE_USE_NAMES[use]}</strong>
        <small className={styles.note}>{own ? `This device shows ${CODE_STYLE_NAMES[own]}s.` : `Follows the site: ${CODE_STYLE_NAMES[site]}.`}</small>
      </span>
      <div className={styles.bar}>
        <Button variant={own === null ? 'primary' : 'secondary'} onClick={() => setCodeStyle(use, 'site')} aria-pressed={own === null}>
          Follow The Site
        </Button>
        {STYLES.map((s) => (
          <Button key={s} variant={own === s ? 'primary' : 'secondary'} onClick={() => setCodeStyle(use, s)} aria-pressed={own === s}>
            {CODE_STYLE_NAMES[s]}
          </Button>
        ))}
      </div>
    </div>
  );
}
