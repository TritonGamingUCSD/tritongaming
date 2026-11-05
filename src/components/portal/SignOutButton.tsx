'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './SignOutButton.module.css';

export default function SignOutButton({ plain = false, className = '' }: { plain?: boolean; className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (plain)
    return (
      <button type="button" className={className} onClick={handleSignOut}>
        Sign out
      </button>
    );
  return (
    <button className={styles.btn} onClick={handleSignOut}>
      <span aria-hidden="true" className={styles.icon}>
        <LogOut size={15} strokeWidth={2} />
      </span>{' '}
      Sign Out
    </button>
  );
}
