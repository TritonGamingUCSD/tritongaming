import { Megaphone } from 'lucide-react';
import styles from './PortalBanner.module.css';

// A short notice from the Admins at the top of every portal page (Admin → System → Settings).
export default function PortalBanner({ text }: { text: string }) {
  return (
    <div className={styles.banner} role="status">
      <Megaphone size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
      <p className={styles.text}>{text}</p>
    </div>
  );
}
