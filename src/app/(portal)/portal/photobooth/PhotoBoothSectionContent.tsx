'use client';

import { useCallback, useState } from 'react';
import SectionHeader from '@/components/ui/SectionHeader';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import { BoothRun } from './BoothRun';
import { BoothSetup } from './BoothSetup';
import { BoothsTab } from './BoothsTab';
import { NewBoothPage } from './NewBoothPage';
import { parsePhotoBoothRoute, photoBoothParams, type PhotoBoothRoute } from './photoboothRoute';
import styles from './photobooth.module.css';

// The Photo Booth: officers and above make booths (not tied to any event, like Trivia quizzes: layout, look, a frame of its own, which stickers to offer), keep the sticker library, and run a booth on a screen at an event. Guests scan the QR code
// the booth shows and download their picture from /photos/<token> without an account. Every place has its own address (see photoboothRoute.ts).
export default function PhotoBoothSectionContent() {
  const { tab, subtab } = useUrlNav();
  const setParams = usePortalParams();
  const [route, setRoute] = useState<PhotoBoothRoute>(() => parsePhotoBoothRoute(tab, subtab));
  const go = useCallback(
    (r: PhotoBoothRoute) => {
      setRoute(r);
      setParams({ section: 'photobooth', ...photoBoothParams(r) });
    },
    [setParams],
  );

  if (route.tab === 'run') return <BoothRun booth={route.booth} onExit={() => go({ tab: 'setup', booth: route.booth, tool: 'photos' })} />;
  if (route.tab === 'new')
    return (
      <div className={styles.page}>
        <NewBoothPage onBack={() => go({ tab: 'booths' })} onMade={(booth, open) => go(open ? { tab: 'run', booth } : { tab: 'setup', booth, tool: 'photos' })} />
      </div>
    );
  if (route.tab === 'setup')
    return (
      <div className={styles.page}>
        <BoothSetup
          booth={route.booth}
          tool={route.tool}
          onTool={(tool) => go({ tab: 'setup', booth: route.booth, tool })}
          onBack={() => go({ tab: 'booths' })}
          onDeleted={() => go({ tab: 'booths' })}
          onRun={() => go({ tab: 'run', booth: route.booth })}
        />
      </div>
    );
  return (
    <div className={styles.page}>
      <SectionHeader
        title="Photo Booth"
        flush
        sub="Make a booth, set it up, then run it on a screen at an event: guests place stickers, pose for the countdown and scan a QR code to download their picture."
      />
      <BoothsTab onNew={() => go({ tab: 'new' })} onOpen={(booth) => go({ tab: 'setup', booth, tool: 'photos' })} onRun={(booth) => go({ tab: 'run', booth })} />
    </div>
  );
}
