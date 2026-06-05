import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Gamepad2, ExternalLink, Award } from "lucide-react";
import indieGamesData from "@/data/tgex/indie-games.json";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";

function normalizeStudioName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function getStudioData(slug: string) {
  return indieGamesData.find(
    (studio) => normalizeStudioName(studio.name) === slug
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ studio: string }>;
}): Promise<Metadata> {
  const { studio } = await params;
  const studioData = getStudioData(studio);
  return {
    title: studioData?.name || "Indie Studio",
    description: `Discover games and learn about ${studioData?.name || "this indie studio"} at TGEX 2026`,
  };
}

export async function generateStaticParams() {
  return indieGamesData.map((studio) => ({
    studio: normalizeStudioName(studio.name),
  }));
}

export default async function IndieStudioPage({
  params,
}: {
  params: Promise<{ studio: string }>;
}) {
  const { studio } = await params;
  const studioData = getStudioData(studio);

  if (!studioData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="font-bungee text-3xl text-tgex-yellow">Studio Not Found</h1>
          <Link
            href="/tgex/indie-games"
            className="mt-4 inline-block text-tgex-teal hover:text-tgex-yellow"
          >
            ← Back to Indie Games
          </Link>
        </div>
      </div>
    );
  }

  const relatedStudios = indieGamesData
    .filter((s) => normalizeStudioName(s.name) !== studio)
    .slice(0, 3);

  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      {/* Header */}
      <Reveal className="mb-12 rounded-xl border border-tgex-indigo/50 bg-gradient-to-r from-tgex-indigo/20 to-tgex-purple/20 p-12 text-center">
        <div className="relative h-24 w-24 mx-auto mb-6">
          <Image
            src={studioData.logo}
            alt={studioData.name}
            fill
            className="object-contain"
            quality={100}
          />
        </div>
        <h1 className="font-bungee text-5xl uppercase text-white sm:text-6xl">
          {studioData.name}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-tgex-light/80">
          Indie game development studio showcased at TGEX 2026
        </p>
      </Reveal>

      {/* Studio Info */}
      <RevealGroup className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <RevealItem><div className="rounded-xl border border-tgex-indigo/30 bg-tgex-indigo/10 p-6">
          <Gamepad2 className="mb-3 h-8 w-8 text-tgex-indigo" />
          <h3 className="font-bungee text-sm uppercase text-tgex-indigo">Total Games</h3>
          <p className="mt-2 text-3xl font-bungee text-tgex-light">
            {studioData.games.length}
          </p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-teal/30 bg-tgex-teal/10 p-6">
          <Award className="mb-3 h-8 w-8 text-tgex-teal" />
          <h3 className="font-bungee text-sm uppercase text-tgex-teal">Award Winning</h3>
          <p className="mt-2 text-sm text-tgex-light/70">
            Industry recognized indie developer
          </p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-yellow/30 bg-tgex-yellow/10 p-6">
          <Gamepad2 className="mb-3 h-8 w-8 text-tgex-yellow" />
          <h3 className="font-bungee text-sm uppercase text-tgex-yellow">Booth</h3>
          <p className="mt-2 text-sm text-tgex-light/70">Visit our exhibition booth</p>
        </div></RevealItem>
      </RevealGroup>

      {/* Games Section */}
      {studioData.games.length > 0 && (
        <div className="mb-12">
          <Reveal><h2 className="mb-6 font-bungee text-3xl uppercase text-tgex-yellow">
            Featured Games
          </h2></Reveal>
          <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {studioData.games.map((game) => (
              <RevealItem key={game}>
              <div
                className="holographic-card holo-card h-full rounded-xl border border-white/10 bg-tgex-navy/50 p-8 transition-all hover:border-tgex-yellow/50 hover:shadow-[0_0_24px_rgba(247,202,102,0.25)]"
              >
                <Gamepad2 className="mb-3 h-8 w-8 text-tgex-yellow" aria-hidden />
                <h3 className="font-bungee text-2xl uppercase text-white">{game}</h3>
                <p className="mt-3 text-sm text-tgex-light/70">
                  Developed by {studioData.name}
                </p>
                <div className="mt-4 flex gap-2">
                  <a
                    href="https://store.steampowered.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-tgex-teal/50 bg-tgex-teal/10 px-4 py-2 text-xs font-bungee uppercase text-tgex-teal transition-all hover:border-tgex-teal hover:bg-tgex-teal/20"
                  >
                    View on Steam
                    <ExternalLink size={14} aria-hidden />
                  </a>
                </div>
              </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      )}

      {/* About Section */}
      <Reveal className="mb-12 rounded-xl border border-white/10 bg-tgex-navy/50 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-indigo">About {studioData.name}</h2>
        <p className="mt-4 text-tgex-light/80">
          {studioData.description || `${studioData.name} is an independent game development studio dedicated to creating unique and engaging gaming experiences. At TGEX 2026, you'll have the opportunity to meet the team, play their games, and learn about their creative process.`}
        </p>
        <p className="mt-4 text-tgex-light/80">
          Join us at the indie games booth to experience what makes {studioData.name} special
          and discover what they&apos;re working on next!
        </p>
      </Reveal>

      {/* Booth Details */}
      <RevealGroup className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <RevealItem><div className="rounded-xl border border-tgex-magenta/30 bg-tgex-magenta/10 p-8">
          <h3 className="font-bungee text-lg uppercase text-tgex-magenta">Booth Location</h3>
          <p className="mt-3 text-tgex-light/80">
            Price Center, Exhibit Hall C
            <br />
            Booth #IC-{studioData.name.charCodeAt(0)}
          </p>
          <p className="mt-4 text-sm text-tgex-light/60">
            Visit us to play the latest builds and meet the developers!
          </p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-coral/30 bg-tgex-coral/10 p-8">
          <h3 className="font-bungee text-lg uppercase text-tgex-coral">Hours</h3>
          <p className="mt-3 text-tgex-light/80">
            Saturday: 10:00 AM - 6:00 PM
            <br />
            Sunday: 11:00 AM - 5:00 PM
          </p>
          <p className="mt-4 text-sm text-tgex-light/60">
            Expect demos, Q&A, and exclusive announcements!
          </p>
        </div></RevealItem>
      </RevealGroup>

      {/* Related Studios */}
      {relatedStudios.length > 0 && (
        <div className="mb-12">
          <Reveal><h2 className="mb-6 font-bungee text-2xl uppercase text-tgex-light">
            Other Indie Studios at TGEX
          </h2></Reveal>
          <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {relatedStudios.map((related) => (
              <RevealItem key={related.name}>
              <Link
                href={`/indie-games/${normalizeStudioName(related.name)}`}
                className="holographic-card holo-card block h-full rounded-xl border border-white/10 bg-tgex-navy/50 p-6 transition-all hover:border-tgex-indigo/50 hover:shadow-[0_0_24px_rgba(102,51,153,0.25)]"
              >
                <div className="relative h-12 w-12 mb-3">
                  <Image
                    src={related.logo}
                    alt={related.name}
                    fill
                    className="object-contain"
                    quality={100}
                  />
                </div>
                <h3 className="font-bungee text-sm uppercase text-tgex-indigo">
                  {related.name}
                </h3>
                <p className="mt-2 text-xs text-tgex-light/60">
                  {related.games.length} {related.games.length === 1 ? "game" : "games"}
                </p>
              </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      )}

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
