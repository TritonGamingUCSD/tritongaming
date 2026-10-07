import Link from '@/components/portal/NoPrefetchLink';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import type { TodoItem } from '@/lib/portal/todos';
import styles from './dashboard.module.css';

// Everything waiting on this person, together at the top of the portal home. Urgent ones first and highlighted.
export default function TodoCard({ items }: { items: TodoItem[] }) {
  if (items.length === 0) return null;
  const sorted = [...items.filter((i) => i.tone === 'urgent'), ...items.filter((i) => i.tone !== 'urgent')];
  return (
    <section className={styles.todoCard} aria-label="To do">
      <h2 className={styles.todoHead}><ClipboardCheck size={16} aria-hidden="true" /> To do <span className={styles.todoCount}>{items.length}</span></h2>
      <ul className={styles.todoList}>
        {sorted.map((t) => (
          <li key={t.id}>
            <Link href={t.href} className={`${styles.todoRow} ${t.tone === 'urgent' ? styles.todoUrgent : ''}`}>
              <span className={styles.todoDot} aria-hidden="true" />
              <span className={styles.todoText}><strong>{t.text}</strong>{t.detail && <em>{t.detail}</em>}</span>
              <ChevronRight size={16} aria-hidden="true" className={styles.todoGo} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
