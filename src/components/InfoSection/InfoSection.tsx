import Image from 'next/image';
import styles from './InfoSection.module.css';

interface InfoSectionProps {
  title: string;
  text: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  tag?: string;
  photoCredit?: string;
  photoCreditLink?: string;
}

export default function InfoSection({
  title,
  text,
  image,
  imageAlt,
  reverse = false,
  photoCredit,
  photoCreditLink,
}: InfoSectionProps) {
  return (
    <div className={`${styles.section} ${reverse ? styles.reverse : ''}`}>
      <div className={styles.imageWrapper}>
        <div className={styles.scribbleWrapper} aria-hidden="true">
          <Image src="/images/scribble.png" alt="" fill unoptimized style={{ objectFit: 'contain', opacity: 0.06, filter: 'invert(1)' }} />
        </div>
        <div className={styles.photo}>
          <Image src={image} alt={imageAlt} fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
        </div>
        {photoCredit && photoCreditLink && (
          <a href={photoCreditLink} target="_blank" rel="noopener noreferrer" className={styles.credit}>
            Photo Credit: {photoCredit}
          </a>
        )}
      </div>

      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{text}</p>
      </div>
    </div>
  );
}
