import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Blocks,
  Crosshair,
  Drum,
  Flag,
  Flame,
  Gamepad2,
  Music2,
  Palette,
  Shield,
  Sparkles,
  Sword,
  Swords,
} from "lucide-react";
import { divisions, type DivisionAccent, type DivisionIconKey } from "@/data/tgex/divisions";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Community Divisions",
  description:
    "Explore Triton Gaming community divisions at TGEX 2026, from competitive teams to creative clubs.",
};

const accentClasses: Record<DivisionAccent, { border: string; pill: string; title: string; glow: string }> = {
  teal: {
    border: "border-tgex-teal/40",
    pill: "border-tgex-teal/60 bg-tgex-teal/10 text-tgex-teal",
    title: "text-tgex-teal",
    glow: "hover:shadow-[0_0_28px_rgba(71,169,155,0.35)]",
  },
  pink: {
    border: "border-tgex-pink/40",
    pill: "border-tgex-pink/60 bg-tgex-pink/10 text-tgex-pink",
    title: "text-tgex-pink",
    glow: "hover:shadow-[0_0_28px_rgba(244,76,167,0.35)]",
  },
  yellow: {
    border: "border-tgex-yellow/40",
    pill: "border-tgex-yellow/60 bg-tgex-yellow/10 text-tgex-yellow",
    title: "text-tgex-yellow",
    glow: "hover:shadow-[0_0_28px_rgba(247,202,102,0.35)]",
  },
  indigo: {
    border: "border-tgex-indigo/40",
    pill: "border-tgex-indigo/60 bg-tgex-indigo/10 text-tgex-indigo",
    title: "text-tgex-indigo",
    glow: "hover:shadow-[0_0_28px_rgba(67,59,178,0.35)]",
  },
  orange: {
    border: "border-tgex-orange/40",
    pill: "border-tgex-orange/60 bg-tgex-orange/10 text-tgex-orange",
    title: "text-tgex-orange",
    glow: "hover:shadow-[0_0_28px_rgba(255,178,77,0.35)]",
  },
  magenta: {
    border: "border-tgex-magenta/40",
    pill: "border-tgex-magenta/60 bg-tgex-magenta/10 text-tgex-magenta",
    title: "text-tgex-magenta",
    glow: "hover:shadow-[0_0_28px_rgba(255,29,111,0.35)]",
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

export default function DivisionsPage() {
  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      <Reveal className="mb-10 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-teal/50 bg-tgex-teal/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-teal">
          Community Spotlight
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          <LetterDrop text="Triton Divisions" />
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-tgex-light/75">
          Meet the communities that power Triton Gaming. Explore competitive teams, music groups, and creator clubs active at TGEX 2026.
        </p>
      </Reveal>

      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {divisions.map((division) => {
          const Icon = iconMap[division.icon];
          const styles = accentClasses[division.accent];

          return (
            <RevealItem key={division.slug}>
            <Link
              href={`/divisions/${division.slug}`}
              className={`holographic-card holo-card block h-full rounded-xl border bg-tgex-navy/55 p-6 transition-all hover:-translate-y-1 ${styles.border} ${styles.glow}`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-bungee text-xs uppercase tracking-[0.2em] ${styles.pill}`}>
                  <Icon size={14} aria-hidden />
                  Division
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white/5 p-1">
                    {division.logo ? (
                      <Image
                        src={division.logo}
                        alt={`${division.name} logo`}
                        fill
                        className="object-contain"
                        sizes="40px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-bungee text-xs text-white/50">
                        {division.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-white/40" aria-hidden />
                </div>
              </div>
              <h2 className={`font-bungee text-xl uppercase ${styles.title}`}>{division.name}</h2>
              <p className="mt-3 text-sm text-tgex-light/75">{division.shortDescription}</p>
            </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </div>
  );
}
