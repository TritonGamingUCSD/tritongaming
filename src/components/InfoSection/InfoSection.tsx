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

// A photo taped to the board next to a short piece of writing. The tag is the sticker on the photo; the credit sits under it.
export default function InfoSection({ title, text, image, imageAlt, reverse = false, tag, photoCredit, photoCreditLink }: InfoSectionProps) {
  return (
    <div className={`${styles.section} ${reverse ? styles.reverse : ''}`}>
      <figure className={styles.print}>
        <span className={styles.tape} aria-hidden="true" />
        <div className={styles.photo}>
          <Image src={image} alt={imageAlt} fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'cover' }} />
          {tag && <span className={styles.tag}>{tag}</span>}
        </div>
        {photoCredit && (
          <figcaption className={styles.credit}>
            Photo:{' '}
            {photoCreditLink ? <a href={photoCreditLink} target="_blank" rel="noopener noreferrer">{photoCredit}</a> : photoCredit}
          </figcaption>
        )}
      </figure>

      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.text}>{text}</p>
      </div>
    </div>
  );
}
