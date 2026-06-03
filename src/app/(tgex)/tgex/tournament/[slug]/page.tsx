import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, MapPin, Trophy, Users, Video } from "lucide-react";
import { getTournamentBySlug, tournaments } from "@/data/tgex/tournaments";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return tournaments.map((tournament) => ({ slug: tournament.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);

  if (!tournament) {
    return { title: "Tournament Not Found" };
  }

  return {
    title: tournament.name,
    description: tournament.description,
  };
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const tournament = getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 font-lexend sm:px-6 sm:py-12">
      <div className="mb-8 text-center">
        <span className="inline-block rounded-full border border-tgex-yellow/50 bg-tgex-yellow/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">
          {tournament.day}
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          {tournament.name}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg text-tgex-light/75">
          {tournament.description}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-2xl border border-white/10 bg-tgex-navy/50 p-6 shadow-[0_0_30px_rgba(67,59,178,0.18)]">
          <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">Tournament Overview</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-tgex-teal/30 bg-tgex-teal/10 p-4">
              <p className="text-xs uppercase tracking-wide text-tgex-light/60">Game</p>
              <p className="mt-2 font-bungee text-lg text-tgex-teal">{tournament.game}</p>
            </div>
            <div className="rounded-xl border border-tgex-magenta/30 bg-tgex-magenta/10 p-4">
              <p className="text-xs uppercase tracking-wide text-tgex-light/60">Capacity</p>
              <p className="mt-2 font-bungee text-lg text-tgex-magenta">{tournament.capacity}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/15 p-4 sm:col-span-2">
              <p className="flex items-center gap-2 text-sm text-tgex-light/80">
                <Clock size={16} aria-hidden />
                {tournament.time}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-tgex-light/80">
                <MapPin size={16} aria-hidden />
                {tournament.location}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/15 p-5">
            <h3 className="font-bungee text-lg uppercase text-white">What To Expect</h3>
            <p className="mt-3 text-sm leading-7 text-tgex-light/75">
              Arrive early, check in with tournament staff, and stay near your assigned station as brackets progress. Major matches may be moved to featured stages or stream setups depending on production needs.
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-tgex-dark/60 p-5">
            <h2 className="font-bungee text-lg uppercase text-white">Quick Links</h2>
            <div className="mt-4 flex flex-col gap-3">
              <div className="rounded-2xl border border-tgex-yellow/30 bg-tgex-yellow/10 px-4 py-3 text-center">
                <p className="font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">Registration Closed</p>
                <p className="mt-1 text-xs text-tgex-light/70">This bracket is no longer accepting signups.</p>
              </div>
              {tournament.streamLink && (
                <a
                  href={tournament.streamLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-tgex-magenta/50 bg-tgex-magenta/10 px-4 py-2 font-bungee text-sm uppercase tracking-wider text-tgex-magenta transition-all hover:bg-tgex-magenta/30"
                >
                  Watch Stream
                  <Video size={16} aria-hidden />
                </a>
              )}
              <Link
                href={tournament.scheduleAnchor}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-tgex-teal/50 bg-tgex-teal/10 px-4 py-2 font-bungee text-sm uppercase tracking-wider text-tgex-teal transition-all hover:bg-tgex-teal/30"
              >
                View Schedule Slot
                <Clock size={16} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-tgex-dark/60 p-5">
            <div className="flex items-center gap-2 text-tgex-light/85">
              <Trophy size={18} aria-hidden />
              <h2 className="font-bungee text-lg uppercase">Competitive Notes</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-tgex-light/75">
              <li>Bracket timing can shift slightly based on check-in and match completion.</li>
              <li>Bring any required peripherals and be ready to report to staff when called.</li>
              <li>Featured matches may move to stage or stream stations during the event.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-tgex-dark/60 p-5">
            <div className="flex items-center gap-2 text-tgex-light/85">
              <Users size={18} aria-hidden />
              <h2 className="font-bungee text-lg uppercase">Need More Events?</h2>
            </div>
            <Link href="/tgex/tournaments" className="mt-4 inline-flex text-sm text-tgex-teal transition-colors hover:text-tgex-yellow">
              Browse all tournaments
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
