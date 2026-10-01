import { Fragment } from 'react';
import styles from './DotList.module.css';

// Hyphens become non-breaking so "Human-Computer" is never split at the dash.
export function noBreakHyphens(text: string): string {
  return text.replace(/-/g, '\u2011');
}

// "Cognitive Science · 3rd Year · Sixth College" as separate whole pieces: the
// line can wrap *between* items but never inside one, so "Cognitive Science"
// is never split across two lines. The dot stays attached to the item before
// it, so a wrapped line never starts with a stray "·". (An item that's longer
// than the whole line by itself still has to wrap, since nothing else can give.)
export default function DotList({ items }: { items: Array<string | null | undefined | false> }) {
  const list = items.filter((i): i is string => Boolean(i));
  return (
    <>
      {list.map((item, i) => (
        <Fragment key={`${item}-${i}`}>
          {i > 0 && ' '}
          <span className={styles.item}>{noBreakHyphens(item)}{i < list.length - 1 ? ' ·' : ''}</span>
        </Fragment>
      ))}
    </>
  );
}
