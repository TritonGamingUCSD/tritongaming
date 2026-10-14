import Loading from './Loading';
import styles from './Loading.module.css';

// The full-page version, used by every loading.tsx so the opening screens are the same everywhere; only the background and the words differ.
//   portal  the member portal and sign-in: the portal's paper or navy, following the saved light/dark choice (already on the page by now: the root layout's
//           script sets it on a full load, and PortalThemeInit does when arriving from another page)
//   site    the public site: its navy, inside the page area under the navbar
//   auto    the very first screen, before Next knows which area is loading: the root layout marked portal pages, so it takes the portal's look there
//           and the site's navy everywhere else
// It renders no script: React never runs a script rendered during in-app navigation, and warns about it.
export default function PageLoading({ area, label, fixed = false }: { area: 'portal' | 'site' | 'auto'; label: string; fixed?: boolean }) {
  const look = area === 'portal' ? styles.areaPortal : area === 'auto' ? styles.areaAuto : styles.areaSite;
  return (
    <div className={`${styles.screen} ${look} ${fixed ? styles.fixed : ''} ${area === 'site' ? styles.inPage : ''}`}>
      <Loading variant="page" label={label} />
    </div>
  );
}
