import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Gamepad2, ExternalLink, ArrowLeft } from "lucide-react";
import indieGamesData from "@/data/tgex/indie-games.json";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Indie Games",
  description: "Discover indie game studios at TGEX 2026. Meet developers, play games, and support independent creators.",
};

function normalizeStudioName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export default function IndieGamesPage() {
  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      {/* Header */}
      <Reveal className="mb-12 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-indigo/50 bg-tgex-indigo/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-indigo">
          Indie Showcase
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          <LetterDrop text="Indie Games" />
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-tgex-light/70">
          Discover and support independent game developers showcasing their work at TGEX 2026. Play games, meet creators, and connect with the indie gaming community.
        </p>
      </Reveal>

      {/* Info Cards */}
      <RevealGroup className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealItem><div className="rounded-xl border border-tgex-indigo/30 bg-tgex-indigo/10 p-6">
          <Gamepad2 className="mb-3 h-8 w-8 text-tgex-indigo" />
          <h3 className="font-bungee text-sm uppercase text-tgex-indigo">
            {indieGamesData.length} Studios
          </h3>
          <p className="mt-2 text-sm text-tgex-light/70">
            Independent developers from around the world
          </p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-teal/30 bg-tgex-teal/10 p-6">
          <Gamepad2 className="mb-3 h-8 w-8 text-tgex-teal" />
          <h3 className="font-bungee text-sm uppercase text-tgex-teal">30+ Games</h3>
          <p className="mt-2 text-sm text-tgex-light/70">
            Award-winning indie titles across multiple genres
          </p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-magenta/30 bg-tgex-magenta/10 p-6">
          <Gamepad2 className="mb-3 h-8 w-8 text-tgex-magenta" />
          <h3 className="font-bungee text-sm uppercase text-tgex-magenta">Playable Demos</h3>
          <p className="mt-2 text-sm text-tgex-light/70">Try before you buy at our exhibition booths</p>
        </div></RevealItem>
      </RevealGroup>

      {/* Studios Grid */}
      <div className="mb-12">
        <Reveal><h2 className="mb-6 font-bungee text-3xl uppercase text-tgex-yellow">Featured Studios</h2></Reveal>
        <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {indieGamesData.map((studio) => (
            <RevealItem key={studio.name}>
            <Link
              href={`/indie-games/${normalizeStudioName(studio.name)}`}
              className="holographic-card holo-card group block h-full rounded-xl border border-white/10 bg-tgex-navy/50 p-8 transition-all hover:border-tgex-indigo/50 hover:shadow-[0_0_32px_rgba(102,51,153,0.25)]"
            >
              <div className="relative h-20 w-full mb-6">
                <Image
                  src={studio.logo}
                  alt={studio.name}
                  fill
                  className="object-contain group-hover:scale-105 transition-transform"
                  quality={100}
                />
              </div>
              <h3 className="font-bungee text-lg uppercase text-white group-hover:text-tgex-indigo transition-colors">
                {studio.name}
              </h3>
              <p className="mt-2 text-sm text-tgex-light/70">
                {studio.games.length} {studio.games.length === 1 ? "game" : "games"} on display
              </p>
              {studio.games.length > 0 && (
                <div className="mt-4 space-y-1">
                  {studio.games.slice(0, 2).map((game) => (
                    <p key={game} className="text-xs text-tgex-teal">
                      • {game}
                    </p>
                  ))}
                  {studio.games.length > 2 && (
                    <p className="text-xs text-tgex-light/50">+{studio.games.length - 2} more</p>
                  )}
                </div>
              )}
              <div className="mt-4 inline-flex items-center gap-1 font-bungee text-xs uppercase text-tgex-indigo group-hover:text-tgex-magenta transition-colors">
                <span>Learn More</span>
                <ExternalLink size={14} aria-hidden />
              </div>
            </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>

      {/* Visit Booths Section */}
      <div className="mb-12 rounded-xl border border-tgex-indigo/50 bg-gradient-to-r from-tgex-indigo/20 to-tgex-purple/20 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-indigo">Visit Our Indie Booths</h2>
        <p className="mt-3 text-tgex-light/80">
          All participating indie studios have booths in our Exhibit Hall. Come play demos, meet the developers, ask questions, and support independent game creators!
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-tgex-indigo/30 bg-white/5 p-4">
            <p className="font-bungee text-sm uppercase text-tgex-indigo">Saturday</p>
            <p className="mt-2 text-sm text-tgex-light/70">10:00 AM - 6:00 PM</p>
          </div>
          <div className="rounded-lg border border-tgex-indigo/30 bg-white/5 p-4">
            <p className="font-bungee text-sm uppercase text-tgex-indigo">Sunday</p>
            <p className="mt-2 text-sm text-tgex-light/70">11:00 AM - 5:00 PM</p>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="mb-12 rounded-xl border border-white/10 bg-tgex-navy/50 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">About the Indie Showcase</h2>
        <p className="mt-4 text-tgex-light/80">
          TGEX 2026&apos;s Indie Showcase celebrates independent game developers and their creative work. We&apos;re proud to feature studios from across the globe, showcasing everything from pixel art platformers to award-winning narrative experiences.
        </p>
        <p className="mt-4 text-tgex-light/80">
          Whether you&apos;re a gamer looking to discover your next favorite game or a developer interested in the indie scene, our showcase offers a unique opportunity to connect with creators and explore the cutting edge of independent game development.
        </p>
      </div>

      {/* Back Link */}
      <div className="text-center">
        <Link href="/tgex" className="inline-flex items-center gap-2 text-tgex-teal hover:text-tgex-yellow transition-colors">
          <ArrowLeft size={18} aria-hidden />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
