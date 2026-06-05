import type { Metadata } from "next";
import Link from "next/link";

import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Alternate Universes",
  description: "Explore TGEX 2026 alternate universes with unique artwork, merchandise, and themes.",
};

const universes = [
  {
    slug: "street-universe",
    name: "Street Universe",
    emoji: "🏙️",
    description: "Urban vibes, graffiti art, street culture, and modern aesthetics meet gaming.",
    color: "tgex-teal",
    bgColor: "from-tgex-teal/20 to-tgex-cyan/20",
  },
  {
    slug: "star-guardian",
    name: "Star Guardian",
    emoji: "✨",
    description: "Celestial wonder, cosmic mysteries, and otherworldly beauty.",
    color: "tgex-indigo",
    bgColor: "from-tgex-indigo/20 to-tgex-purple/20",
  },
  {
    slug: "fire-realm",
    name: "Fire Realm",
    emoji: "🔥",
    description: "Intense action, blazing battles, and fiery energy.",
    color: "tgex-orange",
    bgColor: "from-tgex-orange/20 to-tgex-coral/20",
  },
  {
    slug: "comic-dimension",
    name: "Comic Dimension",
    emoji: "💭",
    description: "Pop art, comic book aesthetics, and vibrant storytelling.",
    color: "tgex-magenta",
    bgColor: "from-tgex-magenta/20 to-tgex-pink/20",
  },
];

export default function UniversesPage() {
  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      {/* Header */}
      <Reveal className="mb-12 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-magenta/50 bg-tgex-magenta/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-magenta">
          Multiverse Collection
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          <LetterDrop text="Alternate Universes" />
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-tgex-light/70">
          Explore four unique universes, each with its own aesthetic, artwork, and exclusive merchandise at TGEX 2026.
        </p>
      </Reveal>

      {/* About Section */}
      <Reveal className="mb-12 rounded-xl border border-white/10 bg-tgex-navy/50 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">About Our Universes</h2>
        <p className="mt-4 text-tgex-light/80">
          TGEX 2026 features four distinct alternate universes, each offering a completely unique gaming and entertainment experience. From cyberpunk streets to cosmic realms, each universe has its own art style, community, and limited-edition collectibles.
        </p>
        <p className="mt-4 text-tgex-light/80">
          Collectors are encouraged to explore all four universes and complete their collections with exclusive stickers, prints, apparel, and merchandise only available during TGEX 2026.
        </p>
      </Reveal>

      {/* Universes Grid */}
      <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {universes.map((universe) => (
          <RevealItem key={universe.slug}>
          <div
            className={`holographic-card holo-card group block h-full rounded-xl border-2 p-8 transition-all hover:shadow-lg ${universe.bgColor}`}
            style={{
              borderColor: `var(--color-${universe.color})`,
              background: `linear-gradient(to right, var(--color-${universe.color}33), ${universe.slug === "star-guardian" ? "var(--color-tgex-purple33)" : universe.slug === "fire-realm" ? "var(--color-tgex-coral33)" : universe.slug === "comic-dimension" ? "var(--color-tgex-pink33)" : "var(--color-tgex-cyan33)"})`,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-4xl">{universe.emoji}</p>
                <h3 className="mt-3 font-bungee text-2xl uppercase text-white">
                  {universe.name}
                </h3>
                <p className="mt-2 text-tgex-light/80">{universe.description}</p>
              </div>
            </div>
          </div>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* Collection Benefits */}
      <Reveal className="mt-12 rounded-xl border border-tgex-yellow/30 bg-tgex-yellow/10 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">Collector&apos;s Benefits</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-yellow">Complete a Universe</p>
            <p className="mt-2 text-sm text-tgex-light/70">Collect all items from one universe and receive an exclusive collector&apos;s badge</p>
          </div>
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-yellow">Master Collector</p>
            <p className="mt-2 text-sm text-tgex-light/70">Collect from all four universes to earn the Master Collector status and special recognition</p>
          </div>
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-yellow">Limited Edition</p>
            <p className="mt-2 text-sm text-tgex-light/70">All merchandise is exclusive to TGEX 2026 and not available anywhere else</p>
          </div>
        </div>
      </Reveal>

      {/* Back Link */}
      <div className="mt-12 text-center">
        <Link href="/tgex" className="text-tgex-teal hover:text-tgex-yellow transition-colors">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
