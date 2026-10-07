'use client';

import { Users } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import { useEditingPresence } from '@/lib/ui/useEditingPresence';

const join = (names: string[]) => names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// "Ana is also editing this": shown above an editor while someone else has the same thing open. `what` reads in the sentence ("this event").
// Saves are last-one-wins here, so it also says so: coordinate, or the last Save changes replaces the other.
export default function EditingNow({ room, what = 'this', onLight = false }: { room: string | null; what?: string; onLight?: boolean }) {
  const others = useEditingPresence(room);
  if (others.length === 0) return null;
  const names = others.map((o) => o.name);
  return (
    <Notice tone="warning" compact onLight={onLight}>
      <Users size={14} aria-hidden="true" /> <strong>{join(names)} {others.length === 1 ? 'is' : 'are'} also editing {what} right now.</strong> Whoever saves last replaces the other’s changes, so check with {others.length === 1 ? 'them' : 'each other'} first.
    </Notice>
  );
}
