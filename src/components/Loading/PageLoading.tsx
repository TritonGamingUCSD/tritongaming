import Loading from './Loading';
import { THEME_SCRIPT } from '@/lib/portal/themeScript';
import styles from './Loading.module.css';

// The full-page version, used by every loading.tsx so the opening screens are the same everywhere; only the background and the words differ.
//   portal  the member portal and sign-in: the portal's paper or navy, following the saved light/dark choice (set here, because the layout that
//           normally sets it has not rendered yet)
//   site    the public site: its navy, inside the page area under the navbar
//   auto    the very first screen, before Next knows which area is loading: it picks portal or site from the address
export default function PageLoading({ area, label, fixed = false }: { area: 'portal' | 'site' | 'auto'; label: string; fixed?: boolean }) {
  const script = area === 'portal'
    ? THEME_SCRIPT
    : area === 'auto'
      ? `if(/^\\/(portal|login|auth)(\\/|$)/.test(location.pathname)){${THEME_SCRIPT}document.currentScript.parentElement.setAttribute('data-area','portal')}`
      : null;
  return (
    <div className={`${styles.screen} ${area === 'portal' ? styles.areaPortal : styles.areaSite} ${fixed ? styles.fixed : ''} ${area === 'site' ? styles.inPage : ''}`} data-area={area === 'portal' ? 'portal' : undefined}>
      {script && <script dangerouslySetInnerHTML={{ __html: script }} />}
      <Loading variant="page" label={label} />
    </div>
  );
}
