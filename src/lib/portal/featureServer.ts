import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/admin';
import { SWITCH_DB_KEYS, parseOff } from './featureSwitches';

// Which feature switches are off, for server routes and public pages. One small cached read (tag 'switches', refreshed the moment an admin flips a switch, and at most every few minutes otherwise).
// If the read fails it says nothing is off, so a database hiccup never takes a feature away.
export async function getOffSwitches(): Promise<string[]> {
  try {
    return await unstable_cache(
      async () => {
        const { data, error } = await createServiceClient()
          .from('team_settings')
          .select('key, value')
          .in('key', [...SWITCH_DB_KEYS]);
        if (error) throw error;
        return parseOff(data);
      },
      ['feature-switches'],
      { revalidate: 300, tags: ['switches'] },
    )();
  } catch {
    return [];
  }
}

/** Whether a feature is on right now. */
export async function featureEnabled(key: string): Promise<boolean> {
  return !(await getOffSwitches()).includes(key);
}
