'use client';

import { GripVertical, Plus, Trash2 } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import { useDragReorder } from '@/lib/useDragReorder';
import type { ScheduleItem, EventSponsor } from '@/types/database';
import styles from './eventextras.module.css';

interface Props {
  venueAddress: string;
  venueNotes: string;
  schedule: ScheduleItem[];
  sponsors: EventSponsor[];
  onVenueAddress: (v: string) => void;
  onVenueNotes: (v: string) => void;
  onSchedule: (v: ScheduleItem[]) => void;
  onSponsors: (v: EventSponsor[]) => void;
}

// Venue (address → map on the public page), a run-of-show schedule, and the
// event's sponsors. All optional: a section only appears on the public event
// page when it has something in it.
export default function EventExtrasEditor({ venueAddress, venueNotes, schedule, sponsors, onVenueAddress, onVenueNotes, onSchedule, onSponsors }: Props) {
  const sched = useDragReorder(schedule, onSchedule);
  const spons = useDragReorder(sponsors, onSponsors);

  return (
    <div className={styles.wrap}>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Venue</legend>
        <label className={styles.field}>
          <span className={styles.label}>Address</span>
          <input className={styles.input} value={venueAddress} onChange={(e) => onVenueAddress(e.target.value)} placeholder="e.g. 9500 Gilman Dr, La Jolla, CA 92093" />
          <span className={styles.hint}>Shows a map on the public event page. Leave blank for online events.</span>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Directions, parking, accessibility</span>
          <textarea className={styles.input} rows={3} value={venueNotes} onChange={(e) => onVenueNotes(e.target.value)} placeholder="e.g. Park in Gilman Parking Structure — enter through the east doors." />
        </label>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Schedule</legend>
        {schedule.map((item, i) => (
          <div key={i} className={`${styles.row} ${sched.dragIndex === i ? styles.dragging : ''} ${sched.overIndex === i && sched.dragIndex !== i ? styles.dragOver : ''}`} {...sched.dropTargetProps(i)}>
            <span className={styles.grip} {...sched.dragHandleProps(i)} aria-label={`Drag to reorder schedule item ${i + 1}`}><GripVertical size={14} aria-hidden="true" /></span>
            <input className={`${styles.input} ${styles.time}`} value={item.time} onChange={(e) => onSchedule(schedule.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} placeholder="6:00 PM" aria-label="Time" />
            <div className={styles.rowMain}>
              <input className={styles.input} value={item.title} onChange={(e) => onSchedule(schedule.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Doors open" aria-label="Title" />
              <input className={styles.input} value={item.description ?? ''} onChange={(e) => onSchedule(schedule.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Optional detail" aria-label="Detail" />
            </div>
            <button type="button" className={styles.remove} onClick={() => onSchedule(schedule.filter((_, j) => j !== i))} aria-label="Remove schedule item"><Trash2 size={14} aria-hidden="true" /></button>
          </div>
        ))}
        <button type="button" className={styles.add} onClick={() => onSchedule([...schedule, { time: '', title: '' }])}><Plus size={14} aria-hidden="true" /> Add schedule item</button>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Sponsors</legend>
        {sponsors.map((sp, i) => (
          <div key={i} className={`${styles.row} ${spons.dragIndex === i ? styles.dragging : ''} ${spons.overIndex === i && spons.dragIndex !== i ? styles.dragOver : ''}`} {...spons.dropTargetProps(i)}>
            <span className={styles.grip} {...spons.dragHandleProps(i)} aria-label={`Drag to reorder sponsor ${i + 1}`}><GripVertical size={14} aria-hidden="true" /></span>
            <div className={styles.logoCell}>
              <ImageUploadField label="Logo" value={sp.logo_url} onChange={(url) => onSponsors(sponsors.map((x, j) => (j === i ? { ...x, logo_url: url } : x)))} bucket="event-flyers" shape="logo" maxDimension={600} />
            </div>
            <div className={styles.rowMain}>
              <input className={styles.input} value={sp.name} onChange={(e) => onSponsors(sponsors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Sponsor name" aria-label="Sponsor name" />
              <input className={styles.input} type="url" value={sp.url ?? ''} onChange={(e) => onSponsors(sponsors.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://… (optional)" aria-label="Sponsor link" />
            </div>
            <button type="button" className={styles.remove} onClick={() => onSponsors(sponsors.filter((_, j) => j !== i))} aria-label="Remove sponsor"><Trash2 size={14} aria-hidden="true" /></button>
          </div>
        ))}
        <button type="button" className={styles.add} onClick={() => onSponsors([...sponsors, { name: '', logo_url: '' }])}><Plus size={14} aria-hidden="true" /> Add sponsor</button>
      </fieldset>
    </div>
  );
}
