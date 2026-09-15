'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './SignOutButton.module.css';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button className={styles.btn} onClick={handleSignOut}>
      <span aria-hidden="true">↩</span> Sign Out
    </button>
  );
}
