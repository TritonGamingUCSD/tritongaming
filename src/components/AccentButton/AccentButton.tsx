'use client';

import Link from 'next/link';
import styles from './AccentButton.module.css';

interface AccentButtonProps {
  text: string;
  href?: string;
  onClick?: () => void;
  target?: '_blank' | '_self';
  className?: string;
}

export default function AccentButton({
  text,
  href,
  onClick,
  target = '_blank',
  className = '',
}: AccentButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href && (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:'))) {
      window.open(href, target);
    }
  };

  // Internal link
  if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
    return (
      <Link href={href} className={`${styles.button} ${className}`}>
        {text}
      </Link>
    );
  }

  return (
    <button className={`${styles.button} ${className}`} onClick={handleClick}>
      {text}
    </button>
  );
}
