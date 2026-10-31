import { formatPacificDate } from '@/lib/core/timezone';
import { Mode } from './types';

export const EVENT_LABEL: Record<string, string> = {
  strike_added: 'Strike added',
  strike_removed: 'Strike taken off',
  strike_reinstated: 'Strike put back',
  voucher_given: 'Voucher given',
  voucher_used: 'Voucher used',
  voucher_removed: 'Voucher removed',
  strikes_reset: 'Strikes reset',
};

export const CATEGORIES: [string, string][] = [
  ['meeting', 'Missed meeting'],
  ['event_shift', 'Missed event shift'],
  ['deadline', 'Missed deadline or task'],
  ['conduct', 'Conduct'],
  ['other', 'Other'],
];

export const catLabel = (id: string) => CATEGORIES.find((c) => c[0] === id)?.[1] ?? 'Other';

export const day = (d: string) => formatPacificDate(d, { year: true });

export const CHOICES: { mode: Mode; title: string; text: string }[] = [
  { mode: 'add', title: 'Add Strike', text: 'They missed it and it counts against them.' },
  { mode: 'excuse', title: 'Excuse', text: 'They had a good reason. Marked excused on the meeting, no strike.' },
  { mode: 'dismiss', title: 'Dismiss', text: 'Not a real miss (say, a wrong list). No strike, nothing marked.' },
];
