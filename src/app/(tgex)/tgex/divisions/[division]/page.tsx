import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Blocks,
  Crosshair,
  Drum,
  Flame,
  Flag,
  Gamepad2,
  Music2,
  Palette,
  Shield,
  Sparkles,
  Sword,
  Swords,
} from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import {
  divisions,
  getDivisionBySlug,
  type Division,
  type DivisionAccent,
  type DivisionIconKey,
} from "@/data/tgex/divisions";

const accentClasses: Record<DivisionAccent, { panel: string; title: string; icon: string; chip: string }> = {
  teal: {
    panel: "border-tgex-teal/50 bg-tgex-teal/10",
    title: "text-tgex-teal",
    icon: "text-tgex-teal",
    chip: "border-tgex-teal/60 bg-tgex-teal/10 text-tgex-teal",
  },
  pink: {
    panel: "border-tgex-pink/50 bg-tgex-pink/10",
    title: "text-tgex-pink",
    icon: "text-tgex-pink",
    chip: "border-tgex-pink/60 bg-tgex-pink/10 text-tgex-pink",
  },
  yellow: {
    panel: "border-tgex-yellow/50 bg-tgex-yellow/10",
    title: "text-tgex-yellow",
    icon: "text-tgex-yellow",
    chip: "border-tgex-yellow/60 bg-tgex-yellow/10 text-tgex-yellow",
  },
  indigo: {
    panel: "border-tgex-indigo/50 bg-tgex-indigo/10",
    title: "text-tgex-indigo",
    icon: "text-tgex-indigo",
    chip: "border-tgex-indigo/60 bg-tgex-indigo/10 text-tgex-indigo",
  },
  orange: {
    panel: "border-tgex-orange/50 bg-tgex-orange/10",
    title: "text-tgex-orange",
    icon: "text-tgex-orange",
    chip: "border-tgex-orange/60 bg-tgex-orange/10 text-tgex-orange",
  },
  magenta: {
    panel: "border-tgex-magenta/50 bg-tgex-magenta/10",
    title: "text-tgex-magenta",
    icon: "text-tgex-magenta",
    chip: "border-tgex-magenta/60 bg-tgex-magenta/10 text-tgex-magenta",
  },
};

const iconMap: Record<DivisionIconKey, React.ComponentType<{ size?: number; className?: string }>> = {
  league: Swords,
  splatoon: Palette,
  melee: Sword,
  valorant: Crosshair,
  fighters: Sparkles,
  pokemon: Shield,
  rivals: Flame,
  orchestra: Music2,
  smash: Gamepad2,
  rhythm: Drum,
  roblox: Blocks,
  "mario-kart": Flag,
  minecraft: Gamepad2,
  keebs: Blocks,
  vgdc: Gamepad2,
  esports: Crosshair,
  artspark: Palette,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ division: string }>;
}): Promise<Metadata> {
  const { division } = await params;
  const divisionData = getDivisionBySlug(division);

  return {
    title: divisionData ? divisionData.name : "Division",
    description: divisionData
      ? `${divisionData.name} at TGEX 2026`
      : "Explore a TGEX 2026 community division.",
  };
}

export async function generateStaticParams() {
  return divisions.map((division) => ({
    division: division.slug,
  }));
}

function getRelatedDivisions(current: Division) {
  return divisions.filter((division) => division.slug !== current.slug).slice(0, 4);
}

export default async function DivisionPage({
  params,
}: {
  params: Promise<{ division: string }>;
}) {
  const { division } = await params;
  const divisionData = getDivisionBySlug(division);

  if (!divisionData) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-bungee text-3xl uppercase text-tgex-yellow">Division Not Found</h1>
          <Link href="/tgex/divisions" className="mt-4 inline-block text-tgex-teal hover:text-tgex-yellow">
            Back to Divisions
          </Link>
        </div>
      </div>
    );
  }

  const Icon = iconMap[divisionData.icon];
  const styles = accentClasses[divisionData.accent];
  const relatedDivisions = getRelatedDivisions(divisionData);

  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      <Reveal className={`mb-8 rounded-xl border p-8 sm:p-12 ${styles.panel}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-bungee text-xs uppercase tracking-[0.2em] ${styles.chip}`}>
            <Icon size={14} aria-hidden />
            TGEX Division
          </div>
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/30 bg-white/10 p-1.5">
            {divisionData.logo ? (
              <Image
                src={divisionData.logo}
                alt={`${divisionData.name} logo`}
                fill
                className="object-contain"
                sizes="56px"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-bungee text-sm text-white/50">
                {divisionData.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <h1 className={`font-bungee text-4xl uppercase sm:text-5xl ${styles.title}`}>{divisionData.name}</h1>
        <p className="mt-4 max-w-3xl text-base text-tgex-light/80 sm:text-lg">{divisionData.shortDescription}</p>
      </Reveal>

      <RevealGroup className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealItem><div className="rounded-xl border border-white/10 bg-tgex-navy/50 p-6">
          <Icon className={`mb-3 h-8 w-8 ${styles.icon}`} aria-hidden />
          <h2 className="font-bungee text-sm uppercase text-white">About</h2>
          <p className="mt-2 text-sm text-tgex-light/75">{divisionData.longDescription}</p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-white/10 bg-tgex-navy/50 p-6">
          <Sparkles className="mb-3 h-8 w-8 text-tgex-yellow" aria-hidden />
          <h2 className="font-bungee text-sm uppercase text-white">At TGEX 2026</h2>
          <p className="mt-2 text-sm text-tgex-light/75">{divisionData.atTgex}</p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-white/10 bg-tgex-navy/50 p-6">
          <Gamepad2 className="mb-3 h-8 w-8 text-tgex-teal" aria-hidden />
          <h2 className="font-bungee text-sm uppercase text-white">Get Involved</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {divisionData.socials.map((social) => (
              <li key={social.platform}>
                <a
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm transition-colors hover:text-white"
                >
                  <span className="font-bungee text-xs uppercase text-tgex-light/50">{social.platform}</span>
                  {social.handle
                    ? <span className="text-tgex-teal">@{social.handle}</span>
                    : <span className="text-tgex-teal">{social.url.replace(/^https?:\/\//, "")}</span>
                  }
                </a>
              </li>
            ))}
          </ul>
        </div></RevealItem>
      </RevealGroup>

      <Reveal className="mb-10 rounded-xl border border-white/10 bg-tgex-navy/50 p-6 sm:p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">Related Divisions</h2>
        <RevealGroup className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedDivisions.map((related) => {
            const RelatedIcon = iconMap[related.icon];
            const relatedStyles = accentClasses[related.accent];

            return (
              <RevealItem key={related.slug}>
              <Link
                href={`/divisions/${related.slug}`}
                className="block rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:border-white/25 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <RelatedIcon className={`h-5 w-5 ${relatedStyles.icon}`} aria-hidden />
                  <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-white/5 p-0.5">
                    <Image
                      src={related.logo}
                      alt={`${related.name} logo`}
                      fill
                      className="object-contain"
                      sizes="32px"
                    />
                  </div>
                </div>
                <p className="mt-2 font-bungee text-xs uppercase text-white">{related.name}</p>
              </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </Reveal>

      <Link
        href="/tgex/divisions"
        className="inline-flex items-center gap-2 text-tgex-teal transition-colors hover:text-tgex-yellow"
      >
        <ArrowLeft size={18} aria-hidden />
        Back to Divisions
      </Link>
    </div>
  );
}
