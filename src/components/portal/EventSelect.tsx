'use client';

import { useEffect, useState } from 'react';
import { Field, Select } from '@/components/ui/Field';
import { call } from '@/lib/ui/apiCall';

// "For event (optional)": ties what is being made (a poll, a Q&A, a booth) to an event, so the event's workspace lists it. Empty means not for an event. `initial` fills it in (the workspace's Start buttons do the same without asking).
export default function EventSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [events, setEvents] = useState<{ id: string; title: string; start_date: string }[]>([]);
  useEffect(() => {
    void call<{ events: { id: string; title: string; start_date: string }[] }>('/api/events/recent').then((r) => r.ok && setEvents(r.data.events));
  }, []);
  return (
    <Field label="For an event (optional)" hint="It then shows in that event’s workspace, under Live Tools.">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not for an event</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title} · {new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </option>
        ))}
      </Select>
    </Field>
  );
}
