import ExecCard from '@/components/ExecCard/ExecCard';
import styles from './ExecList.module.css';
import type { OfficerEntry } from '@/types';

interface ExecListProps {
  officers: OfficerEntry[];
}

const SECTIONS = [
  { heading: 'MR. PRESIDENT', filter: (o: OfficerEntry) => o.title === 'President' },
  { heading: 'Vice Presidents', filter: (o: OfficerEntry) => o.title.startsWith('Vice President') },
  { heading: 'Live Events', filter: (o: OfficerEntry) => o.title === 'Live Events Director' },
  { heading: 'Marketing', filter: (o: OfficerEntry) => o.title === 'Marketing Director' },
  { heading: 'Creative', filter: (o: OfficerEntry) => o.title === 'Creative Director' },
  { heading: 'Social', filter: (o: OfficerEntry) => o.title === 'Social Director' },
  { heading: 'Human Resources', filter: (o: OfficerEntry) => o.title === 'HR Director' },
];

export default function ExecList({ officers }: ExecListProps) {
  return (
    <div className={styles.root}>
      {SECTIONS.map(({ heading, filter }) => {
        const members = officers.filter(filter);
        if (members.length === 0) return null;
        return (
          <section key={heading} className={styles.section}>
            <div className={styles.titleRow}>
              <h2 className={styles.sectionTitle}>{heading}</h2>
            </div>
            {members.map((exec, idx) => (
              <ExecCard key={exec.officer.first_name + idx} exec={exec} reverse={idx % 2 !== 0} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
