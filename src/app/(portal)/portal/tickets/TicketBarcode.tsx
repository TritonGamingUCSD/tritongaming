import styles from './tickets.module.css';

// The barcode and serial number on a ticket's stub. The bars come from the ticket's own id (the same ticket always draws the same bars), so it is decoration, not a code that can be scanned.
export default function TicketBarcode({ id, label = 'Admit One' }: { id: string; label?: string }) {
  let h = 2166136261;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 28; i++) {
    h = Math.imul(h ^ id.charCodeAt(i % id.length), 16777619) >>> 0;
    const w = 1 + (h % 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + 1;
  }
  const serial = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  return (
    <span className={styles.barcode} aria-hidden="true">
      <svg viewBox={`0 0 ${x} 20`} preserveAspectRatio="none" className={styles.barcodeBars}>
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y="0" width={b.w} height="20" fill="currentColor" />
        ))}
      </svg>
      <span className={styles.barcodeText}>
        {label} · No. {serial}
      </span>
    </span>
  );
}
