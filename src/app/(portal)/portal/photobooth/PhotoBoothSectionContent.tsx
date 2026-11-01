'use client';

import { useCallback, useState } from 'react';
import { Camera, Images } from 'lucide-react';
import SectionHeader from '@/components/ui/SectionHeader';
import SectionTabs from '@/components/ui/SectionTabs';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { useUrlNav } from '@/lib/portal/usePortalTabSync';
import { BoothRun } from './BoothRun';
import { BoothSetup } from './BoothSetup';
import { BoothsTab } from './BoothsTab';
import { OverlayLibrary } from './OverlayLibrary';
import { parsePhotoBoothRoute, photoBoothParams, type PhotoBoothRoute } from './photoboothRoute';
import styles from './photobooth.module.css';

// The Photo Booth: officers and above make booths (not tied to any event, like Trivia quizzes: layout, look, which overlays to offer), keep the overlay library, and run a booth on a screen at an event. Guests scan the QR code
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

  if (route.tab === 'run') return <BoothRun booth={route.booth} onExit={() => go({ tab: 'setup', booth: route.booth })} />;
  const inSetup = route.tab === 'setup';
  return (
    <div className={styles.page}>
      <SectionHeader
        title="Photo Booth"
        flush
        sub="Make a booth, set it up, then run it on a screen at an event: guests pick an overlay, pose for the countdown and scan a QR code to download their picture."
      />
      {!inSetup && (
        <SectionTabs
          label="Photo Booth"
          value={route.tab}
          onChange={(t) => go({ tab: t })}
          tabs={[
            { id: 'booths' as const, label: 'Booths', icon: <Camera size={15} /> },
            { id: 'overlays' as const, label: 'Overlays', icon: <Images size={15} /> },
          ]}
        />
      )}
      {route.tab === 'booths' && <BoothsTab onOpen={(booth) => go({ tab: 'setup', booth })} onRun={(booth) => go({ tab: 'run', booth })} />}
      {route.tab === 'overlays' && <OverlayLibrary />}
      {route.tab === 'setup' && (
        <BoothSetup
          booth={route.booth}
          onBack={() => go({ tab: 'booths' })}
          onDeleted={() => go({ tab: 'booths' })}
          onRun={() => go({ tab: 'run', booth: route.booth })}
          onOverlays={() => go({ tab: 'overlays' })}
        />
      )}
    </div>
  );
}
