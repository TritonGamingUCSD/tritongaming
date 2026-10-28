'use client';

import SectionTabs from '@/components/ui/SectionTabs';
import pz from './prizing.module.css';

// Cards or Sheet, at the top of Prizing and Devices (the sheet is for a laptop or a tablet; the switch is hidden on a phone). The choice is in the address (?view=sheet).
export default function ViewSwitch({ sheet, go }: { sheet: boolean; go: (sheet: boolean) => void }) {
  return (
    <div className={`${pz.modeSeg} ${pz.sheetSwitch}`}>
      <SectionTabs<'cards' | 'sheet'> variant="segmented" label="Cards or the sheet" value={sheet ? 'sheet' : 'cards'} onChange={(v) => go(v === 'sheet')} tabs={[{ id: 'cards', label: 'Cards' }, { id: 'sheet', label: 'Sheet' }]} />
    </div>
  );
}
