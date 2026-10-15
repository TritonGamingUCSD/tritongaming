'use client';

import { createContext, useContext } from 'react';
import type { EventSponsor, ReportMetric } from '@/types/database';
import styles from './summary.module.css';

export interface ReportState { preparedFor: EventSponsor | null; social: ReportMetric[]; sponsors: EventSponsor[] }
export const ReportCtx = createContext<ReportState>({ preparedFor: null, social: [], sponsors: [] });

// Shown under the date when a sponsor is chosen above the sheet.
export function PreparedFor() {
  const { preparedFor } = useContext(ReportCtx);
  if (!preparedFor) return null;
  return (
    <p className={styles.preparedFor}>
      <span>Prepared for</span>
      {/* The logo is an address someone typed into the event, from any host, so next/image cannot be configured for it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preparedFor.logo_url && <img src={preparedFor.logo_url} alt="" className={styles.preparedLogo} />}
      <strong>{preparedFor.name}</strong>
    </p>
  );
}

// The numbers typed in by hand (social media reach and the like); nothing is drawn when there are none.
export function SocialReach() {
  const { social } = useContext(ReportCtx);
  const rows = social.filter((m) => m.label.trim() && m.value.trim());
  if (!rows.length) return null;
  return (
    <div className={`${styles.card} ${styles.wide}`}>
      <h3 className={styles.cardTitle}>Social media reach</h3>
      <p className={styles.note}>Reported by Triton Gaming from its own social accounts.</p>
      <dl className={styles.metrics}>
        {rows.map((m, i) => (<div key={i}><dd>{m.value}</dd><dt>{m.label}</dt></div>))}
      </dl>
    </div>
  );
}

// The thank-you at the end. A report made for one sponsor thanks that sponsor only (it is not for the others to read); a general one thanks them all.
export function SponsorThanks({ n }: { n: string }) {
  const { preparedFor, sponsors } = useContext(ReportCtx);
  const list = preparedFor ? [preparedFor] : sponsors;
  if (!list.length) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}><span className={styles.sectionNum}>{n}</span>{preparedFor ? `Thank you, ${preparedFor.name}` : 'With thanks to our sponsors'}</h2>
      <p className={styles.lead}>{preparedFor ? 'Thank you for supporting this event.' : 'This event was supported by:'}</p>
      <ul className={styles.thanks}>
        {list.map((sp) => (
          <li key={sp.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {sp.logo_url && <img src={sp.logo_url} alt="" />}
            <span>{sp.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
