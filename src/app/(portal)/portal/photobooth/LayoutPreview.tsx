import { composition, type BoothConfig, type Overlay } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

// A small drawing of the finished picture for the booth's settings: the photos as grey boxes, the first frame over each, and the footer text, in the chosen colours.
export function LayoutPreview({ config, frame }: { config: BoothConfig; frame?: Overlay }) {
  const comp = composition(config.layout, config.aspect, !!config.footer.trim());
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <div
      className={styles.preview}
      style={{ aspectRatio: `${comp.width} / ${comp.height}`, background: config.strip_bg }}
      role="img"
      aria-label="What the finished picture looks like"
    >
      {comp.cells.map((c, i) => (
        <div key={i} className={styles.previewCell} style={{ left: pct(c.x, comp.width), top: pct(c.y, comp.height), width: pct(c.w, comp.width), height: pct(c.h, comp.height) }}>
          {frame && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame.image} alt="" />
          )}
        </div>
      ))}
      {config.footer.trim() && (
        <div
          className={styles.previewFooter}
          style={{ left: 0, top: pct(comp.footer.y, comp.height), width: '100%', height: pct(comp.footer.h, comp.height), color: config.text_color }}
        >
          {config.footer}
        </div>
      )}
    </div>
  );
}
