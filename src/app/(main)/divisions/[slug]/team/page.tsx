import { notFound } from 'next/navigation';
import { getDivisionBySlug, getDivisions } from '@/lib/members/divisions';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import DivisionSubHero from '../DivisionSubHero';
import DivisionPeople from '../DivisionPeople';
import { getDivisionHubData } from '../getDivisionHubData';
import styles from '../division.module.css';

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getDivisions()).map((d) => ({ slug: d.slug }));
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) return { title: 'Division' };
  return {
    title: `Team · ${division.name}`,
    description: `The team of ${division.name}, a Triton Gaming division. Gaming Org at UC San Diego.`,
    alternates: { canonical: `/${slug}/team` },
  };
}

export default async function DivisionTeamPage({ params }: Params) {
  const { slug } = await params;
  const division = await getDivisionBySlug(slug);
  if (!division) notFound();
  const hub = await getDivisionHubData(division.id);
  const empty = hub.leads.length + hub.members.length + hub.alumni.length === 0;
  return (
    <div className={styles.page}>
      <DivisionSubHero division={division} title="Team" />
      <ZineBand tone="ink" edge={false} label="Team">
        {hub.leads.length > 0 && (
          <>
            <BandHeader label="Say hi" title="Division Heads" />
            <DivisionPeople people={hub.leads} roleLabel="Division Head" />
          </>
        )}
        {hub.members.length > 0 && (
          <>
            <h2 className={styles.groupTitle}>Members</h2>
            <DivisionPeople people={hub.members} roleLabel="Division Member" />
          </>
        )}
        {hub.alumni.length > 0 && (
          <>
            <h2 className={styles.groupTitle}>Alumni</h2>
            <DivisionPeople people={hub.alumni} roleLabel="Division Alumni" />
          </>
        )}
        {empty && <p className={styles.emptyNote}>The {division.name} team will show here soon.</p>}
      </ZineBand>
    </div>
  );
}
