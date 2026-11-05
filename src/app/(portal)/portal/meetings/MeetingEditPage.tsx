'use client';

import { useAddressState, wordCodec } from '@/lib/portal/usePageState';
import SectionTabs from '@/components/ui/SectionTabs';
import DetailHeader from '@/components/ui/DetailHeader';
import styles from './meetings.module.css';
import { DetailsFields, Item, Series } from './types';
import { dayLabel } from './format';
import { SeriesEditForm } from './SeriesEditForm';
import { ItemEditForm } from './ItemEditForm';
import { AdvanceAbsences } from './AdvanceAbsences';

// The full edit page for a meeting, like an event's. A repeating meeting has a switch at the top: just this week, or every week.
export function MeetingEditPage({
  item,
  series,
  busy,
  onBack,
  onSaveItem,
  onSaveSeries,
  onChanged,
}: {
  item: Item | null;
  series: Series | null;
  busy: boolean;
  onBack: () => void;
  onSaveItem: (f: DetailsFields) => Promise<boolean>;
  onSaveSeries: (body: Record<string, unknown>) => Promise<boolean>;
  onChanged: () => void;
}) {
  const [scope, setScope] = useAddressState('scope', wordCodec(['week', 'all'] as const, item ? 'week' : 'all'));
  const title = (scope === 'all' ? series?.title : item?.title) ?? 'Meeting';
  return (
    <div className={styles.stack}>
      <DetailHeader back={{ label: 'Back To Meetings', onClick: onBack }} title={`${title}${item && scope === 'week' ? ` · ${dayLabel(item.date, true)}` : ''}`} />
      {item && series && (
        <SectionTabs<'week' | 'all'>
          label="What to edit"
          variant="segmented"
          value={scope}
          onChange={setScope}
          tabs={[
            { id: 'week', label: 'This Week Only' },
            { id: 'all', label: 'Every Week' },
          ]}
        />
      )}
      {scope === 'week' && item ? (
        <>
          {series && <p className={styles.faint}>Changes here only affect {dayLabel(item.date)}. The usual settings stay as they are.</p>}
          <ItemEditForm
            item={item}
            busy={busy}
            onSave={async (f) => {
              const ok = await onSaveItem(f);
              return ok;
            }}
          />
          <AdvanceAbsences item={item} onChanged={onChanged} />
        </>
      ) : series ? (
        <SeriesEditForm
          series={series}
          busy={busy}
          onCancel={onBack}
          onSave={async (body) => {
            const ok = await onSaveSeries(body);
            if (ok) onBack();
          }}
        />
      ) : null}
    </div>
  );
}
