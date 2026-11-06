import { notFound } from 'next/navigation';
import { getDivisionBySlug, getDivisions } from '@/lib/members/divisions';
import { ZineBand, BandHeader } from '@/components/ZineBand/ZineBand';
import DivisionSubHero from '../DivisionSubHero';
import BoardSection from '@/components/BoardSection/BoardSection';
import { getDivisionCards } from '../getDivisionHubData';
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
  const cards = await getDivisionCards(division.id);
  return (
    <div className={styles.page}>
      <DivisionSubHero division={division} title="Team" />
      <ZineBand tone="ink" edge={false} label="Team">
        {cards.length > 0 ? (
          <BoardSection members={cards} labels={{ lead: 'Division Heads', officer: 'Members', alumni: 'Alumni' }} />
        ) : (
          <p className={styles.emptyNote}>The {division.name} team will show here soon.</p>
        )}
      </ZineBand>
    </div>
  );
}
