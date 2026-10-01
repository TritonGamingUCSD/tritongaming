'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { hasCapability } from '@/lib/capabilities';
import styles from './division.module.css';

// The division page itself is cached and identical for everyone, so whether to
// show "Edit in Portal" is decided here, in the browser, once the visitor's
// roles are known. manage_division(id) is true for lead/exec/admin and for a
// division-role holder only on their own division.
export default function EditDivisionLink({ divisionId }: { divisionId: string }) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
      if (!cancelled && hasCapability(data ?? [], 'manage_division', divisionId)) setCanEdit(true);
    })();
    return () => { cancelled = true; };
  }, [divisionId]);

  if (!canEdit) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Manage Division Page</h2>
      <p className={styles.prose}>Design this page with Markdown, and update the logo, Discord link, officer application link, social links, and posts — all from the portal.</p>
      <Link href={`/portal/divisions/${divisionId}`} className={styles.discordBtn}>Edit in Portal →</Link>
    </section>
  );
}
