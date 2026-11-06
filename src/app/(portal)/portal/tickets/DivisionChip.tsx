import Image from 'next/image';
import styles from './tickets.module.css';

export interface EventDivision {
  name: string;
  logo: string | null;
  hex: string;
}

// A small tag on a ticket for an event a division hosts: its logo and name, edged in the division's color. Club events (no division) show nothing.
export default function DivisionChip({ division }: { division?: EventDivision | null }) {
  if (!division) return null;
  return (
    <span className={styles.divChip} style={{ borderColor: division.hex }}>
      {division.logo ? (
        <Image src={division.logo} alt="" width={18} height={18} unoptimized className={styles.divChipLogo} />
      ) : (
        <span className={styles.divChipDot} style={{ background: division.hex }} />
      )}
      {division.name}
    </span>
  );
}
