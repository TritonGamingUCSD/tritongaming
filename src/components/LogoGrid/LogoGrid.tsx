import Image from 'next/image';
import styles from './LogoGrid.module.css';
import type { LogoItem } from '@/types';

interface LogoGridProps {
  logos: LogoItem[];
}

export default function LogoGrid({ logos }: LogoGridProps) {
  return (
    <div className={styles.grid}>
      {logos.map((logo, index) => {
        const src = logo.logo.startsWith('/') ? logo.logo : `/${logo.logo}`;
        const img = (
          <div className={`${styles.logoWrap} ${styles[`size-${logo.size}`]}`} style={{ order: logo.order ?? index }}>
            <Image
              src={src}
              alt={logo.name}
              fill
              sizes="(max-width: 640px) 100px, (max-width: 1024px) 140px, 180px"
              style={{ objectFit: 'contain' }}
              unoptimized={src.endsWith('.svg')}
            />
          </div>
        );

        return logo.link ? (
          <a
            key={index}
            href={logo.link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logoItem}
            style={{ order: logo.order ?? index }}
            aria-label={logo.name}
          >
            {img}
          </a>
        ) : (
          <div key={index} className={styles.logoItem} style={{ order: logo.order ?? index }}>
            {img}
          </div>
        );
      })}
    </div>
  );
}
