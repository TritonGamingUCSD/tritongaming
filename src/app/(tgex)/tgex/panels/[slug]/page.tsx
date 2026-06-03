import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Mic, MessageCircle, MapPin, Users } from "lucide-react";
import { getPanelBySlug, panels } from "@/data/tgex/panels";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return panels.map((panel) => ({ slug: panel.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const panel = getPanelBySlug(slug);

  if (!panel) {
    return { title: "Panel Not Found" };
  }

  return {
    title: panel.name,
    description: panel.description,
  };
}

export default async function PanelDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const panel = getPanelBySlug(slug);

  if (!panel) {
    notFound();
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 font-lexend sm:px-6 sm:py-12">
      <Reveal className="mb-8 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-pink/50 bg-tgex-pink/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-pink">
          {panel.day}
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          {panel.name}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-lg text-tgex-light/75">
          {panel.description}
        </p>
      </Reveal>

      <RevealGroup className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <RevealItem><section className="rounded-2xl border border-white/10 bg-tgex-navy/50 p-6 shadow-[0_0_30px_rgba(244,76,167,0.18)]">
          <div className="flex items-center gap-2 text-tgex-pink">
            <Mic size={20} aria-hidden />
            <h2 className="font-bungee text-2xl uppercase">Panel Overview</h2>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-tgex-teal/30 bg-tgex-teal/10 p-4">
              <p className="text-xs uppercase tracking-wide text-tgex-light/60">Featured Speakers</p>
              <p className="mt-2 font-bungee text-lg text-tgex-teal">{panel.speaker}</p>
            </div>
            <div className="rounded-xl border border-tgex-magenta/30 bg-tgex-magenta/10 p-4">
              <p className="text-xs uppercase tracking-wide text-tgex-light/60">Session Format</p>
              <p className="mt-2 font-bungee text-lg text-tgex-magenta">Discussion + Q&amp;A</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/15 p-4 sm:col-span-2">
              <p className="flex items-center gap-2 text-sm text-tgex-light/80">
                <Clock size={16} aria-hidden />
                {panel.time}
              </p>
              <p className="mt-3 flex items-center gap-2 text-sm text-tgex-light/80">
                <MapPin size={16} aria-hidden />
                {panel.location}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/15 p-5">
            <div className="flex items-center gap-2 text-tgex-light/85">
              <MessageCircle size={18} aria-hidden />
              <h3 className="font-bungee text-lg uppercase">What You'll Hear</h3>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-tgex-light/75">
              {panel.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>
        </section></RevealItem>

        <RevealItem><aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-tgex-dark/60 p-5">
            <h2 className="font-bungee text-lg uppercase text-white">Quick Links</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href={panel.scheduleAnchor}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-tgex-pink/50 bg-tgex-pink/10 px-4 py-2 font-bungee text-sm uppercase tracking-wider text-tgex-pink transition-all hover:bg-tgex-pink/30"
              >
                View Schedule Slot
                <Clock size={16} aria-hidden />
              </Link>
              <Link
                href="/tgex/schedule"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-tgex-teal/50 bg-tgex-teal/10 px-4 py-2 font-bungee text-sm uppercase tracking-wider text-tgex-teal transition-all hover:bg-tgex-teal/30"
              >
                Full Schedule
                <Users size={16} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-tgex-dark/60 p-5">
            <h2 className="font-bungee text-lg uppercase text-white">Attendee Tips</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-tgex-light/75">
              <li>Arrive a few minutes early for the best seating.</li>
              <li>Have questions ready if the panel includes audience Q&amp;A.</li>
              <li>Check the schedule slot page for nearby sessions before and after.</li>
            </ul>
          </div>
        </aside></RevealItem>
      </RevealGroup>
    </div>
  );
}
