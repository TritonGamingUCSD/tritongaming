import { WEEK_GROUPS, weekGroup } from '@/lib/weekGroups';
import styles from './WeekHead.module.css';

// The heading above each week in a "coming up" list: this week (gold), next week (blue), two weeks out and later (violet).
export default function WeekHead({ date, as: Tag = 'li' }: { date: string; as?: 'li' | 'div' }) {
  const g = WEEK_GROUPS[weekGroup(date)];
  return <Tag className={`${styles.head} ${styles[g.tone]}`}><strong>{g.label}</strong><span>{g.range(date)}</span></Tag>;
}
