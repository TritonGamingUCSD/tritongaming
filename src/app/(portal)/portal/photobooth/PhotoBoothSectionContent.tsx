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

// The Photo Booth: officers and above set up a booth for an event (layout, look, which overlays to offer), keep the overlay library, and run the booth on a screen at the event. Guests scan the QR code
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

  if (route.tab === 'run') return <BoothRun event={route.event} onExit={() => go({ tab: 'setup', event: route.event })} />;
  const inSetup = route.tab === 'setup';
  return (
    <div className={styles.page}>
      <SectionHeader
        title="Photo Booth"
        flush
        sub="Set up a booth for an event, then run it on a screen: guests pick an overlay, pose for the countdown and scan a QR code to download their picture."
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
      {route.tab === 'booths' && <BoothsTab onOpen={(event) => go({ tab: 'setup', event })} onRun={(event) => go({ tab: 'run', event })} />}
      {route.tab === 'overlays' && <OverlayLibrary />}
      {route.tab === 'setup' && (
        <BoothSetup event={route.event} onBack={() => go({ tab: 'booths' })} onRun={() => go({ tab: 'run', event: route.event })} onOverlays={() => go({ tab: 'overlays' })} />
      )}
    </div>
  );
}
