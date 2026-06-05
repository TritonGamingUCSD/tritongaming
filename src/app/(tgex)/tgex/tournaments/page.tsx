import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, MapPin, Clock, Users, ExternalLink } from "lucide-react";
import { tournaments } from "@/data/tgex/tournaments";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Tournaments",
  description: "Follow TGEX 2026 tournaments across fighting games, FPS, strategy, and more with schedule details, bracket info, and stream links.",
};

export default function TournamentsPage() {
  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      {/* Header */}
      <Reveal className="mb-12 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-yellow/50 bg-tgex-yellow/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em]">
          Competitive Gaming
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          <LetterDrop text="TGEX 2026 Tournaments" />
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-tgex-light/70">
          Follow brackets, featured matches, and stream coverage across fighting games, FPS, strategy, and more.
        </p>
      </Reveal>

      {/* Info Section */}
      <RevealGroup className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RevealItem><div className="rounded-xl border border-tgex-yellow/30 bg-tgex-yellow/10 p-6">
          <Trophy className="mb-3 h-8 w-8 text-tgex-yellow" />
          <h3 className="font-bungee text-sm uppercase text-tgex-yellow">Multiple Games</h3>
          <p className="mt-2 text-sm text-tgex-light/70">Valorant, League of Legends, Mario Kart, Rivals, and Fighting Game tournaments</p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-teal/30 bg-tgex-teal/10 p-6">
          <Users className="mb-3 h-8 w-8 text-tgex-teal" />
          <h3 className="font-bungee text-sm uppercase text-tgex-teal">100+ Competitors</h3>
          <p className="mt-2 text-sm text-tgex-light/70">Join players across multiple skill levels for intense competition</p>
        </div></RevealItem>
        <RevealItem><div className="rounded-xl border border-tgex-magenta/30 bg-tgex-magenta/10 p-6">
          <ExternalLink className="mb-3 h-8 w-8 text-tgex-magenta" />
          <h3 className="font-bungee text-sm uppercase text-tgex-magenta">Live Streamed</h3>
          <p className="mt-2 text-sm text-tgex-light/70">Major tournaments streamed live on Twitch for viewers at home</p>
        </div></RevealItem>
      </RevealGroup>

      {/* Tournament Cards */}
      <RevealGroup className="grid grid-cols-1 gap-6">
        {tournaments.map((tournament) => (
          <RevealItem key={tournament.name}>
          <div
            className="holographic-card holo-card rounded-xl border border-white/10 bg-tgex-navy/50 p-6 transition-all hover:border-tgex-teal/40 hover:shadow-[0_0_32px_rgba(71,169,155,0.25)]"
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
              {/* Left: Tournament Info */}
              <div className="sm:col-span-2">
                <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">{tournament.name}</h2>
                <p className="mt-2 text-tgex-light/80">{tournament.description}</p>

                {/* Details Grid */}
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-tgex-light/60">Game Type</p>
                    <p className="mt-1 font-bungee text-sm text-tgex-teal">{tournament.game}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-tgex-light/60">Capacity</p>
                    <p className="mt-1 font-bungee text-sm text-tgex-teal">{tournament.capacity}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs uppercase tracking-wide text-tgex-light/60">Location</p>
                    <p className="mt-1 flex items-center gap-1 font-bungee text-sm text-tgex-teal">
                      <MapPin size={14} aria-hidden />
                      {tournament.location.split(",")[0]}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-xs uppercase tracking-wide text-tgex-light/60">Time</p>
                    <p className="mt-1 flex items-center gap-1 font-bungee text-sm text-tgex-teal">
                      <Clock size={14} aria-hidden />
                      Sat/Sun
                    </p>
                  </div>
                </div>

                {/* Full Details */}
                <div className="mt-4 text-xs text-tgex-light/60">
                  <p className="flex items-center gap-2">
                    <Clock size={16} aria-hidden />
                    {tournament.time}
                  </p>
                  <p className="mt-2 flex items-center gap-2">
                    <MapPin size={16} aria-hidden />
                    {tournament.location}
                  </p>
                </div>

                <Link
                  href={`/tournament/${tournament.slug}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-tgex-teal transition-colors hover:text-tgex-yellow"
                >
                  View details
                  <span aria-hidden>→</span>
                </Link>
              </div>

              {/* Right: Action Buttons */}
              <div className="flex flex-col gap-3 sm:justify-start">
                <div className="rounded-2xl border border-tgex-yellow/30 bg-tgex-yellow/10 px-4 py-3 text-center">
                  <p className="font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">Registration Closed</p>
                  <p className="mt-1 text-xs text-tgex-light/70">Brackets are locked in for TGEX 2026.</p>
                </div>

                {tournament.streamLink && (
                  <a
                    href={tournament.streamLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-tgex-magenta/50 bg-tgex-magenta/10 px-4 py-2 font-bungee text-sm uppercase tracking-wider text-tgex-magenta transition-all hover:bg-tgex-magenta/30 hover:shadow-[0_0_20px_rgba(255,29,111,0.5)]"
                  >
                    <span>Watch Stream</span>
                    <ExternalLink size={16} aria-hidden />
                  </a>
                )}
              </div>
            </div>
          </div>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* FAQ Section */}
      <div className="mt-12 rounded-xl border border-tgex-indigo/30 bg-tgex-indigo/10 p-8">
        <h3 className="font-bungee text-2xl uppercase text-tgex-indigo">Tournament FAQ</h3>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-light">Are tournament signups still open?</p>
            <p className="mt-2 text-sm text-tgex-light/70">No. Tournament signups are closed, but you can still use this page to follow schedule slots and stream coverage for featured matches.</p>
          </div>
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-light">What are the prize distributions?</p>
            <p className="mt-2 text-sm text-tgex-light/70">Prize pools vary by tournament size. Check the individual tournament details for specific payouts to 1st, 2nd, and 3rd place.</p>
          </div>
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-light">How do I keep up with multiple brackets?</p>
            <p className="mt-2 text-sm text-tgex-light/70">If you&apos;re already checked into multiple events, follow tournament staff directions closely and keep an eye on your assigned schedule slots.</p>
          </div>
          <div>
            <p className="font-bungee text-sm uppercase text-tgex-light">Will tournaments be streamed?</p>
            <p className="mt-2 text-sm text-tgex-light/70">Major tournaments will be streamed live on our Twitch channel. Check the tournament card for stream availability.</p>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-8 text-center">
        <Link href="/tgex" className="text-tgex-teal hover:text-tgex-yellow transition-colors">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
