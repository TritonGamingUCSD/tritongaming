import styles from './HeaderStack.module.css';

// The announcement banner and nav bar are stacked together in ONE fixed
// block instead of each being independently `position: fixed`. Previously
// they both pinned to the viewport's top edge on their own — same spot,
// and since the nav bar has a higher z-index and an opaque background, it
// fully covered the banner, which was the site's "the banner never shows"
// bug. Stacking them as flow children of a single fixed container means
// the banner (when present) naturally pushes the nav bar down instead of
// being hidden behind it, with no height measurement needed.
export default function HeaderStack({ banner, nav }: { banner: React.ReactNode; nav: React.ReactNode }) {
  return (
    <div className={styles.stack}>
      {banner}
      {nav}
    </div>
  );
}
