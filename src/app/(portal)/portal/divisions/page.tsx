import { redirect } from 'next/navigation';
import { getUserRoles } from '@/lib/auth';
import { hasCapability } from '@/lib/capabilities';
import { createClient } from '@/lib/supabase/server';
import DivisionsManager from './DivisionsManager';
import styles from './divisions.module.css';

export const metadata = { title: 'Divisions' };
export const dynamic = 'force-dynamic';

export default async function DivisionsPage() {
  const roles = await getUserRoles();
  if (!hasCapability(roles, 'manage_divisions_directory')) redirect('/portal');

  const supabase = await createClient();
  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name, slug, description, logo_url')
    .order('name', { ascending: true });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Divisions</h1>
          <p className={styles.sub}>
            Manage the division directory — this powers both the public /divisions
            pages and who can be assigned as a division lead.
          </p>
        </div>
      </div>

      <DivisionsManager divisions={divisions ?? []} />
    </div>
  );
}
