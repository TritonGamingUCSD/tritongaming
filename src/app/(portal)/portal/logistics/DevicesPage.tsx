'use client';

import { useEffect, useMemo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import Dialog, { DialogActions, DialogCancel } from '@/components/ui/Dialog';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import SectionTabs from '@/components/ui/SectionTabs';
import { Select } from '@/components/ui/Field';
import { DEVICE_GROUPS, type DeviceGroup } from '@/lib/logistics/deviceGroups';
import { RowMenu } from './RowMenu';
import EquipmentTab from './EquipmentTab';
import PlanView from './PlanView';
import ToolsTab, { type ToolsPart } from './ToolsTab';
import { useCloseEvent } from './CloseEvent';
import { autoPlan, eventLabel } from './eventPick';
import { usePlanList } from './usePlans';
import type { Catalog, LogisticsApi } from './useLogistics';
import type { Route } from './logisticsRoute';
import styles from './logistics.module.css';
import pz from './prizing.module.css';

type DevicesRoute = Extract<Route, { tab: 'devices' }>;

// Devices: every device and, with an event picked, where each one goes and how far it is through the steps. One page for planning (the ID boxes that give each row its device) and the event day (the step
// boxes, the parts chips, typing an ID), switched at the top; Event Day is where it opens on the event's own day. Group by Station, Type, Shelf, Status, Owner (club, sponsor and officer loaners) or Games.
// With no event it is the stock: add, edit, shelves, conditions. The gear holds this page's lists (device types, shelves, games, kit parts, bundles, event steps). The grouping, the mode and
// "unfinished only" are in the address, so a link opens exactly this view.
export default function DevicesPage({ api, data, route, go }: { api: LogisticsApi; data: Catalog; route: DevicesRoute; go: (r: Route) => void }) {
  const list = usePlanList();
  const [gear, setGear] = useState(false);
  // "One section at a time" (opening a team folds the others) is remembered on this device; it is on until turned off.
  const [accordion, setAccordion] = useState(true);
  useEffect(() => { try { setAccordion(localStorage.getItem('tg-devices-accordion') !== '0'); } catch { /* not remembered */ } }, []);
  const flipAccordion = () => setAccordion((v) => { try { localStorage.setItem('tg-devices-accordion', v ? '0' : '1'); } catch { /* not remembered */ } return !v; });
  const chosen = useMemo(() => {
    if (!list.plans) return undefined;
    if (route.plan === 'stock') return null;
    return list.plans.find((p) => p.slug === route.plan) ?? autoPlan(list.plans, list.today);
  }, [list.plans, list.today, route.plan]);
  const closer = useCloseEvent(list, () => void list.reload());
  const isToday = !!chosen && chosen.status === 'draft' && chosen.starts_on <= list.today && list.today <= chosen.ends_on;
  const day = !!chosen && (route.day ?? isToday);
  const group: DeviceGroup = route.group ?? (chosen ? 'station' : 'type');
  const to = (patch: Partial<Omit<DevicesRoute, 'tab'>>) => go({ tab: 'devices', plan: route.plan, ...(route.day !== undefined ? { day: route.day } : {}), ...(route.group ? { group: route.group } : {}), ...(route.openOnly ? { openOnly: true } : {}), ...patch });

  if (!list.plans) return <div className={styles.tab}>{list.error ? <Notice tone="error">{list.error}</Notice> : <Loading variant="inline" label="Loading…" />}</div>;
  return (
    <div className={`${styles.tab} ${pz.page}`}>
      <div className={pz.top}>
        <div className={pz.pick}>
          <Select value={chosen?.slug ?? 'stock'} onChange={(e) => go({ tab: 'devices', plan: e.target.value })} aria-label="Event">
            {list.plans.map((p) => <option key={p.id} value={p.slug}>{eventLabel(p)}</option>)}
            <option value="stock">No event (stock only)</option>
          </Select>
        </div>
        {chosen && (
          <div className={pz.modeSeg}>
            <SectionTabs<'plan' | 'day'> variant="segmented" label="Planning or event day" value={day ? 'day' : 'plan'} onChange={(v) => to({ day: v === 'day' })} tabs={[{ id: 'plan', label: 'Planning' }, { id: 'day', label: 'Event Day' }]} />
          </div>
        )}
        <div className={`${pz.pick} ${pz.pickSmall}`}>
          <Select value={group} onChange={(e) => to({ group: e.target.value as DeviceGroup })} aria-label="Group by">
            {DEVICE_GROUPS.filter((g) => chosen || (g.id !== 'station' && g.id !== 'owner')).map((g) => <option key={g.id} value={g.id}>Group by: {g.label}</option>)}
          </Select>
        </div>
        <div className={pz.topEnd}>
          {chosen && <label className={pz.oneAtATime} title="Opening a section folds the others"><input type="checkbox" checked={accordion} onChange={flipAccordion} /> One at a time</label>}
          {data.canManage && <button type="button" className={pz.gear} onClick={() => setGear(true)} aria-label="Device settings" title="Device types, shelves, games, kit parts, bundles and event steps"><Settings2 size={17} aria-hidden="true" /></button>}
          {data.canManage && chosen && (
            <RowMenu label="This event" items={[
              { label: 'Requests', onClick: () => go({ tab: 'events', plan: chosen.slug, page: 'requests' }) },
              { label: 'Sponsor Loaners', onClick: () => go({ tab: 'events', plan: chosen.slug, page: 'sponsor-loaners' }) },
              { label: 'Officer Loaners', onClick: () => go({ tab: 'events', plan: chosen.slug, page: 'officer-loaners' }) },
              { label: 'Prizing', onClick: () => go({ tab: 'prizing', plan: chosen.slug }) },
              chosen.status === 'closed' ? { label: 'Reopen This Event', onClick: () => void closer.reopen(chosen.id) } : { label: 'Close This Event', onClick: () => void closer.close(chosen) },
            ]} />
          )}
        </div>
      </div>
      {chosen ? (
        <PlanView key={chosen.id} id={chosen.id} data={data} catalog={api} page="device" day={day} group={group} embedded accordion={accordion} openOnly={!!route.openOnly} onOpenOnly={(v) => to({ openOnly: v || undefined })}
          onOpenPrizing={() => go({ tab: 'prizing', plan: chosen.slug })} onPage={(page) => go({ tab: 'events', plan: chosen.slug, page })} onBack={() => go({ tab: 'devices', plan: 'stock' })} />
      ) : <EquipmentTab api={api} data={data} group={group} />}
      {closer.dialog}
      {gear && <DevicesSettings api={api} data={data} onClose={() => setGear(false)} />}
    </div>
  );
}

function DevicesSettings({ api, data, onClose }: { api: LogisticsApi; data: Catalog; onClose: () => void }) {
  const [tab, setTab] = useState<ToolsPart>('lists');
  const n = (...k: (keyof Catalog['lists'])[]) => k.reduce((t, x) => t + data.lists[x].length, 0);
  return (
    <Dialog title="Device Settings" wide sheet onClose={onClose}>
      <SectionTabs<ToolsPart> variant="segmented" label="Device settings" value={tab} onChange={setTab} tabs={[
        { id: 'lists', label: 'Equipment Lists', count: n('type', 'shelf', 'tier', 'port', 'game', 'kit') }, { id: 'bundles', label: 'Bundles', count: n('bundle') }, { id: 'event-steps', label: 'Event Steps', count: n('step') },
      ]} />
      <ToolsTab api={api} data={data} section={tab} />
      <DialogActions><DialogCancel onClick={onClose}>Done</DialogCancel></DialogActions>
    </Dialog>
  );
}
