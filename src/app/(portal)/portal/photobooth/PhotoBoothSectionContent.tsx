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
import { TextStickerDesigner } from './TextStickerDesigner';
import { NewBoothPage } from './NewBoothPage';
import { OverlayLibrary } from './OverlayLibrary';
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

  if (route.tab === 'run') return <BoothRun booth={route.booth} onExit={() => go({ tab: 'setup', booth: route.booth })} />;
  if (route.tab === 'text')
    return (
      <div className={styles.page}>
        <TextStickerDesigner onBack={() => go({ tab: 'overlays' })} />
      </div>
    );
  if (route.tab === 'new')
    return (
      <div className={styles.page}>
        <NewBoothPage onBack={() => go({ tab: 'booths' })} onMade={(booth, open) => go(open ? { tab: 'run', booth } : { tab: 'setup', booth })} />
      </div>
    );
  const inSetup = route.tab === 'setup';
  return (
    <div className={styles.page}>
      <SectionHeader
        title="Photo Booth"
        flush
        sub="Make a booth, set it up, then run it on a screen at an event: guests place stickers, pose for the countdown and scan a QR code to download their picture."
      />
      {!inSetup && (
        <SectionTabs
          label="Photo Booth"
          value={route.tab}
          onChange={(t) => go({ tab: t })}
          tabs={[
            { id: 'booths' as const, label: 'Booths', icon: <Camera size={15} /> },
            { id: 'overlays' as const, label: 'Stickers', icon: <Images size={15} /> },
          ]}
        />
      )}
      {route.tab === 'booths' && <BoothsTab onNew={() => go({ tab: 'new' })} onOpen={(booth) => go({ tab: 'setup', booth })} onRun={(booth) => go({ tab: 'run', booth })} />}
      {route.tab === 'overlays' && <OverlayLibrary onDesignText={() => go({ tab: 'text' })} />}
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
