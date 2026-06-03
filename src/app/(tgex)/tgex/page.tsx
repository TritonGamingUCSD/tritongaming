"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";

const PamphletViewer = dynamic(() => import("@/components/tgex/pamphlet-viewer"), { ssr: false });

import {
  Blocks,
  Compass,
  Crosshair,
  Drum,
  Flag,
  Flame,
  Gamepad2,
  Gift,
  MessageCircle,
  Mic,
  Music2,
  Palette,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Theater,
  Trophy,
  Users,
} from "lucide-react";
import ZoomableImage from "@/components/tgex/zoomable-image";
import { useScrollFocus } from "@/hooks/useScrollFocus";
import { AnimatedCounter } from "@/components/tgex/animated-counter";
import indieGames from "@/data/tgex/indie-games.json";
import sponsorsData from "@/data/tgex/sponsors.json";
import { divisions, type DivisionIconKey } from "@/data/tgex/divisions";

const divisionIconMap: Record<DivisionIconKey, React.ComponentType<{ size?: number; className?: string }>> = {
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

export default function Home() {
  // Scroll focus hooks - reduces opacity for sections not in view
  const heroRef = useScrollFocus<HTMLDivElement>();
  const bannerRef = useScrollFocus<HTMLDivElement>();
  const featuresRef = useScrollFocus<HTMLDivElement>();
  const activitiesFocusRef = useScrollFocus<HTMLDivElement>();
  const divisionsFocusRef = useScrollFocus<HTMLDivElement>();
  const sponsorsFocusRef = useScrollFocus<HTMLDivElement>();
  const indieGamesFocusRef = useScrollFocus<HTMLDivElement>();
  const statsRef = useScrollFocus<HTMLDivElement>();
  return (
    <div className="font-lexend">

      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <section id="home" ref={heroRef} className="relative mx-auto flex min-h-[80vh] w-full max-w-[100rem] flex-col justify-center overflow-hidden px-4 pb-12 pt-10 sm:px-8 sm:pt-16">

        {/* Floating mascots — kept minimal to avoid visual overload */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden>
          {/* Tex — right side, main hero mascot */}
          <Image
            src="/mascots/tex.png"
            alt=""
            width={480}
            height={480}
            className="cosmic-float absolute -right-8 bottom-0 w-36 opacity-55 sm:w-64 sm:opacity-80 md:w-80 lg:w-[400px] xl:w-[480px] 2xl:w-[560px]"
            style={{ "--dur": "4.5s", "--delay": "0.6s", filter: "drop-shadow(0 0 40px #F44CA799)" } as React.CSSProperties}
          />
          {/* Byte — bottom-left, subtle accent */}
          <Image
            src="/mascots/byte.png"
            alt=""
            width={300}
            height={300}
            className="cosmic-float absolute bottom-0 left-4 hidden w-44 opacity-40 sm:block lg:w-64 xl:w-80 2xl:w-96"
            style={{ "--dur": "5s", "--delay": "1.2s", filter: "drop-shadow(0 0 24px #47A99B88)" } as React.CSSProperties}
          />
        </div>

        {/* Ambient glow orbs */}
        <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
          <div className="absolute left-1/4 top-8 h-56 w-56 rounded-full bg-tgex-magenta/20 blur-[80px]" />
          <div className="absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-tgex-teal/15 blur-[90px]" />
        </div>

        {/* Hero text content */}
        <div className="stagger-children animate-enter relative z-10 space-y-5 text-center" style={{ animationDelay: "50ms" }}>
          <div className="inline-flex flex-col items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full border border-tgex-magenta/60 bg-tgex-magenta/20 px-5 py-2 font-bungee text-sm uppercase tracking-[0.22em] text-tgex-pink">
              Thank You, Attendees!
            </span>
            <span className="font-bungee text-xs uppercase tracking-[0.3em] text-tgex-muted">
              May 30–31, 2026 · UCSD Price Center · Event Ended
            </span>
          </div>

          <h1
            className="glitch text-balance font-bungee text-5xl uppercase leading-tight text-white drop-shadow-[0_2px_32px_rgba(244,76,167,0.5)] sm:text-6xl md:text-7xl lg:text-8xl"
            data-text="Enter The Multiverse"
          >
            Enter The Multiverse
          </h1>

          <p className="mx-auto max-w-2xl text-pretty text-lg text-tgex-light/90 sm:text-xl 2xl:text-2xl">
            Thank you to everyone who made the 10th Anniversary an unforgettable adventure. Relive the memories from two incredible days at UCSD Price Center.
          </p>

          {/* Primary CTA — event album */}
          <div className="flex justify-center">
            <Link
              href="/tgex/album"
              className="ticket-beacon inline-flex flex-col items-center gap-1 rounded-full bg-tgex-magenta px-8 py-4 font-bungee uppercase tracking-wider text-white shadow-[0_0_32px_rgba(255,29,111,0.6)] transition-all hover:scale-105 hover:shadow-[0_0_52px_rgba(255,29,111,0.9)] sm:flex-row sm:gap-3"
            >
              <span className="text-base sm:text-lg">📸 View Event Album</span>
              <span className="rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-semibold tracking-widest sm:text-xs">TGEX 2026 PHOTOS</span>
            </Link>
          </div>

          {/* Scavenger Hunt — featured activity */}
          <div className="flex justify-center">
            <Link
              href="/tgex/scavenger-hunt"
              className="inline-flex items-center gap-2 rounded-full border-2 border-tgex-yellow/70 bg-tgex-yellow/10 px-6 py-2.5 font-bungee text-sm uppercase tracking-wider text-tgex-yellow backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-yellow/25 hover:shadow-[0_0_24px_rgba(247,202,102,0.5)]"
            >
              🌌 Save the Universe (Scavenger Hunt)
            </Link>
          </div>

          {/* Secondary nav links */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/tgex/album"
              className="rounded-full border-2 border-tgex-yellow/70 bg-tgex-dark/60 px-6 py-2.5 text-center font-bungee text-sm uppercase tracking-wider text-tgex-yellow backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-yellow/20 hover:shadow-[0_0_24px_rgba(247,202,102,0.4)]"
            >
              Album
            </Link>
            <Link
              href="/tgex/schedule"
              className="rounded-full border-2 border-tgex-teal/70 bg-tgex-dark/60 px-6 py-2.5 text-center font-bungee text-sm uppercase tracking-wider text-tgex-teal backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-teal/20 hover:shadow-[0_0_24px_rgba(71,169,155,0.4)]"
            >
              Schedule
            </Link>
            <Link
              href="/tgex/sponsors"
              className="rounded-full border-2 border-tgex-pink/60 bg-tgex-dark/60 px-6 py-2.5 text-center font-bungee text-sm uppercase tracking-wider text-tgex-pink backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-pink/20 hover:shadow-[0_0_24px_rgba(244,76,167,0.35)]"
            >
              Sponsors
            </Link>
            <Link
              href="/tgex/divisions"
              className="rounded-full border-2 border-tgex-indigo/70 bg-tgex-dark/60 px-6 py-2.5 text-center font-bungee text-sm uppercase tracking-wider text-tgex-light backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-indigo/20 hover:shadow-[0_0_24px_rgba(67,59,178,0.4)]"
            >
              Divisions
            </Link>
          </div>
        </div>
      </section>

      {/* ─── PAMPHLET ──────────────────────────────────────────────────── */}
      <section id="pamphlet" className="animate-enter mx-auto w-full max-w-5xl px-4 py-10 sm:px-8" style={{ animationDelay: "70ms" }}>
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full border border-tgex-magenta/60 bg-tgex-magenta/15 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-magenta">
            📖 Event Pamphlet
          </span>
          <h2 className="mt-3 font-bungee text-3xl uppercase text-white drop-shadow-[0_2px_16px_rgba(255,29,111,0.4)] sm:text-4xl">
            Everything You Need to Know
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-tgex-light/70">
            Browse the official TGEX 2026 pamphlet — schedules, maps, activities, and more.
          </p>
        </div>
        <div className="rounded-2xl border border-tgex-magenta/40 bg-tgex-navy/30 p-4 shadow-[0_0_60px_rgba(255,29,111,0.2)] backdrop-blur-sm sm:p-6">
          <PamphletViewer />
        </div>
      </section>

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ─── EVENT BANNER ──────────────────────────────────────────────── */}
      <section className="animate-enter mx-auto w-full max-w-[100rem] px-4 py-3 sm:px-8" style={{ animationDelay: "80ms" }}>
        <div className="scan-sweep relative overflow-hidden rounded-2xl border border-tgex-magenta/60 shadow-[0_0_60px_rgba(244,76,167,0.3)]">
          <Image
            src="/digital/tgex-marquee.png"
            alt="TGEX 2026 — The Multiverse event banner"
            width={1920}
            height={540}
            priority
            quality={100}
            className="h-auto w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-tgex-dark/60 via-transparent to-transparent" />
        </div>
      </section>

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ─── FEATURE CARDS ─────────────────────────────────────────────── */}
      <section ref={featuresRef} className="stagger-children mx-auto grid w-full max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {[
          { title: "Panels & Guests", desc: "Industry speakers and voice actor sessions", color: "text-tgex-pink",   border: "border-tgex-pink/40",   glow: "hover:shadow-[0_0_32px_rgba(244,76,167,0.45)]",  Icon: Mic, href: "/schedule" },
          { title: "Tournaments",     desc: "Competitive sets across 10+ games",          color: "text-tgex-yellow", border: "border-tgex-yellow/40", glow: "hover:shadow-[0_0_32px_rgba(247,202,102,0.45)]", Icon: Trophy, href: "/tournaments" },
          { title: "Artist Alley",   desc: "Creators, prints, and exclusive merch",      color: "text-tgex-teal",   border: "border-tgex-teal/40",   glow: "hover:shadow-[0_0_32px_rgba(71,169,155,0.45)]",  Icon: Palette, href: "/schedule" },
          { title: "Community",      desc: "Clubs, cosplayers, and fandom groups",       color: "text-tgex-orange", border: "border-tgex-orange/40", glow: "hover:shadow-[0_0_32px_rgba(255,178,77,0.45)]",  Icon: Users, href: "/cosplay-contest" },
        ].map(({ title, desc, color, border, glow, Icon, href }) => (
          <Link
            key={title}
            href={href}
            className={`holographic-card holo-card rounded-xl border ${border} bg-tgex-navy/50 p-5 text-center transition-all hover:-translate-y-1.5 ${glow} cursor-pointer`}
          >
            <Icon className={`mb-4 h-8 w-8 ${color} mx-auto`} aria-hidden />
            <h2 className={`mb-2 font-bungee text-xl uppercase ${color}`}>{title}</h2>
            <p className="text-sm text-tgex-light/90">{desc}</p>
          </Link>
        ))}
      </section>

      {/* ─── FULL-WIDTH HERO IMAGE ─────────────────────────────────────── */}
      <section ref={bannerRef} className="mx-auto w-full max-w-[100rem] px-4 pb-4 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_80px_rgba(67,59,178,0.25)]">
          <Image
            src="/digital/tgex-1080.png"
            alt="TGEX 2026 — Enter The Multiverse"
            width={1920}
            height={1080}
            className="h-auto w-full object-cover blur-0"
            quality={100}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-tgex-dark/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <p className="font-bungee text-2xl uppercase tracking-widest text-tgex-yellow drop-shadow-lg sm:text-4xl xl:text-5xl 2xl:text-6xl">The Multiverse</p>
            <p className="mt-1 font-lexend text-sm text-tgex-light/80 sm:text-base xl:text-lg 2xl:text-xl">10th Annual Triton Gaming Expo · May 30–31, 2026</p>
          </div>
        </div>
      </section>

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ─── ALT UNIVERSE FRAMES ───────────────────────────────────────── */}
      <section id="universes" className="stagger-children animate-enter mx-auto w-full max-w-7xl px-4 py-10 sm:px-8" style={{ animationDelay: "320ms" }}>
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-tgex-purple/50 bg-tgex-purple/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-light">
            Enter The Multiverse
          </span>
          <h2
            className="glitch mt-3 font-bungee text-3xl uppercase text-white sm:text-4xl"
            data-text="Alt Universe Tex"
          >
            Alt Universe Tex
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-tgex-light/70">
            Four alternate universes collide at TGEX 2026. Which version of Tex will you find?
          </p>
        </div>

        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { frame: "/frames/frame-graffiti.png",      mascot: "/mascots/tex-graffiti.png",      label: "Street Universe", color: "border-tgex-orange/50",     glow: "hover:shadow-[0_0_36px_rgba(255,178,77,0.5)]",    badge: "text-tgex-orange", mascotFilter: "drop-shadow(0 0 14px rgba(255,178,77,0.9))" },
            { frame: "/frames/frame-star-guardian.png", mascot: "/mascots/tex-star-guardian.png", label: "Star Guardian",   color: "border-tgex-pink/50",       glow: "hover:shadow-[0_0_36px_rgba(244,76,167,0.5)]",    badge: "text-tgex-pink",   mascotFilter: "drop-shadow(0 0 14px rgba(244,76,167,0.9))" },
            { frame: "/frames/frame-fire.png",          mascot: "/mascots/tex-flame.png",         label: "Fire Realm",      color: "border-tgex-red-orange/50", glow: "hover:shadow-[0_0_36px_rgba(233,89,58,0.5)]",     badge: "text-tgex-red-orange", mascotFilter: "drop-shadow(0 0 14px rgba(233,89,58,0.9))" },
            { frame: "/frames/frame-comic.png",         mascot: "/mascots/tex.png",               label: "Comic Dimension", color: "border-tgex-teal/50",       glow: "hover:shadow-[0_0_36px_rgba(71,169,155,0.5)]",    badge: "text-tgex-teal",   mascotFilter: "drop-shadow(0 0 14px rgba(71,169,155,0.9))" },
          ].map(({ frame, mascot, label, color, glow, badge, mascotFilter }) => (
            <div
              key={label}
              className={`holographic-card holo-card tilt-card group relative overflow-hidden rounded-xl border ${color} bg-tgex-navy/40 transition-all hover:-translate-y-1.5 ${glow}`}
            >
              <Image
                src={frame}
                alt={label}
                width={400}
                height={500}
                className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width:640px) 45vw, 25vw"
              />
              {/* Alt-universe Tex peeking in from behind on hover */}
              <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-8 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <Image
                  src={mascot}
                  alt=""
                  width={120}
                  height={160}
                  className="cosmic-float h-28 w-auto object-contain"
                  style={{ "--dur": "3s", "--delay": "0s", filter: mascotFilter } as React.CSSProperties}
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-tgex-dark via-tgex-dark/70 to-transparent p-3 sm:p-4">
                <p className={`font-bungee text-xs uppercase tracking-wider ${badge} sm:text-sm`}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ─── COMMUNITY DIVISIONS ──────────────────────────────────────── */}
      <section id="divisions" ref={divisionsFocusRef} className="stagger-children mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-tgex-yellow/50 bg-tgex-yellow/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">
            Community Divisions
          </span>
          <h2 className="mt-3 font-bungee text-3xl uppercase text-white sm:text-4xl">
            Clubs and Teams at TGEX
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-tgex-light/70">
            Discover the communities behind Triton Gaming. Browse all divisions or jump into a specific group.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-tgex-dark/50 py-3">
          <div className="flex items-center gap-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="marquee-track flex shrink-0 items-center gap-4 pr-4" aria-hidden>
              {[...divisions, ...divisions].map((division, index) => {
                const Icon = divisionIconMap[division.icon];
                return (
                  <Link
                    key={`${division.slug}-${index}`}
                    href={`/divisions/${division.slug}`}
                    className="holographic-card holo-card flex min-h-32 w-72 shrink-0 flex-col justify-between rounded-xl border border-white/15 bg-tgex-navy/60 p-4 transition-all hover:-translate-y-1 hover:border-tgex-yellow/50 hover:shadow-[0_0_28px_rgba(247,202,102,0.3)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 text-tgex-yellow">
                        <Icon size={16} aria-hidden />
                        <span className="font-bungee text-xs uppercase tracking-[0.2em]">Division</span>
                      </div>
                      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20 bg-white p-1">
                        {division.logo ? (
                          <Image
                            src={division.logo}
                            alt={`${division.name} logo`}
                            fill
                            className="object-contain"
                            sizes="40px"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-bungee text-xs text-tgex-dark/60">
                            {division.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="font-bungee text-sm uppercase text-white/90">{division.name}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            href="/tgex/divisions"
            className="inline-flex items-center gap-2 rounded-full border-2 border-tgex-yellow/70 bg-tgex-dark/60 px-6 py-2.5 text-center font-bungee text-sm uppercase tracking-wider text-tgex-yellow backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-yellow/20 hover:shadow-[0_0_24px_rgba(247,202,102,0.4)]"
          >
            View All Divisions
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ─── SPONSORS SECTION ──────────────────────────────────────────── */}
      <section id="sponsors" ref={sponsorsFocusRef} className="stagger-children mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-tgex-magenta/50 bg-tgex-magenta/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-magenta">
            Sponsors
          </span>
          <h2 className="mt-3 font-bungee text-3xl uppercase text-white sm:text-4xl">
            Event Sponsors
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-tgex-light/70">
            Thanks to our sponsors making the 10th Anniversary possible.
          </p>
        </div>

        {/* Sponsor logo marquee strip */}
        <div className="mb-6 overflow-hidden rounded-xl border border-white/10 bg-tgex-dark/50 py-3">
          <div className="flex items-center gap-6 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="marquee-track flex shrink-0 items-center gap-10 pr-10" aria-hidden>
              {[...sponsorsData, ...sponsorsData].map((s, i) => (
                <Link
                  key={i}
                  href={`/sponsors`}
                  className="shrink-0 font-bungee text-sm uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* View all sponsors link */}
        <div className="flex justify-center">
          <Link
            href="/tgex/sponsors"
            className="inline-flex items-center gap-2 rounded-full border-2 border-tgex-magenta/70 bg-tgex-dark/60 px-6 py-2.5 text-center font-bungee text-sm uppercase tracking-wider text-tgex-magenta backdrop-blur-sm transition-all hover:scale-105 hover:bg-tgex-magenta/20 hover:shadow-[0_0_24px_rgba(255,29,111,0.4)]"
          >
            View All Sponsors
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ─── INDIE GAMES SHOWCASE ──────────────────────────────────────── */}
      <section id="indie-games" ref={indieGamesFocusRef} className="stagger-children mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-tgex-teal/50 bg-tgex-teal/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-teal">
            Indie Games Showcase
          </span>
          <h2 className="mt-3 font-bungee text-3xl uppercase text-white sm:text-4xl">
            Featured Studios
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-tgex-light/70">
            These amazing indie studios showcased their games on the expo floor.
          </p>
        </div>

        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {indieGames.map((studio) => (
            <Link
              key={studio.name}
              href={`/indie-games/${studio.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="holographic-card group flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-tgex-navy/50 p-4 transition-all hover:-translate-y-1 hover:border-tgex-teal/50 hover:shadow-[0_0_28px_rgba(71,169,155,0.25)] cursor-pointer"
            >
              <div className="relative flex h-16 w-full items-center justify-center">
                <Image
                  src={studio.logo}
                  alt={studio.name}
                  fill
                  className="object-contain"
                  sizes="(max-width:640px) 45vw, 200px"
                />
              </div>
              <p className="text-center font-bungee text-xs uppercase leading-tight tracking-wide text-tgex-light/80">
                {studio.name}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ─── ACTIVITIES & EXPERIENCES ──────────────────────────────────── */}
      <section ref={activitiesFocusRef} className="stagger-children mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-tgex-indigo/50 bg-tgex-indigo/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-light">
            Activities & Experiences
          </span>
          <h2 className="mt-3 font-bungee text-3xl uppercase text-white sm:text-4xl">
            What to Do
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-tgex-light/70">
            From tournaments to treasure hunts, there&apos;s something for everyone.
          </p>
        </div>

        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Scavenger Hunt", desc: "Hunt for items and clues hidden throughout the expo to win exclusive TGEX merchandise.", Icon: Compass, href: null },
            { title: "Cosplay Contest", desc: "Show off your best costume and compete for prizes and recognition on the main stage.", Icon: Theater, href: "/cosplay-contest" },
            { title: "Artist Alley", desc: "Discover original artwork, prints, and commissions from talented indie artists.", Icon: Palette, href: "/schedule" },
            { title: "Tournaments", desc: "Compete in your favorite games across fighting, FPS, and strategy categories.", Icon: Gamepad2, href: "/tournaments" },
            { title: "Panel Discussions", desc: "Learn from industry professionals and content creators in interactive Q&A sessions.", Icon: MessageCircle, href: "/schedule" },
            { title: "Opportunity Draws", desc: "Enter opportunity draws for a chance to win gaming gear and exclusive swag. Open to UCSD affiliates only.", Icon: Gift, href: null },
          ].map(({ title, desc, Icon, href }) => {
            const baseClass = "holographic-card holo-card rounded-xl border border-white/10 bg-tgex-navy/50 p-5 transition-all hover:-translate-y-1 hover:border-tgex-teal/50 hover:shadow-[0_0_24px_rgba(71,169,155,0.25)]";
            const content = (
              <>
                <Icon className="mb-3 h-8 w-8 text-tgex-teal" aria-hidden />
                <h3 className="font-bungee text-sm uppercase text-tgex-teal">{title}</h3>
                <p className="mt-2 text-sm text-tgex-light/80">{desc}</p>
              </>
            );
            return href ? (
              <Link key={title} href={href} className={`${baseClass} cursor-pointer`}>
                {content}
              </Link>
            ) : (
              <div key={title} className={baseClass}>
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── SHARE / SOCIAL PANELS ──────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <p className="font-bungee text-xs uppercase tracking-[0.25em] text-tgex-light/40">Spread the Word</p>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {["/social/panel-first.png", "/social/panel-middle.png", "/social/panel-third.png"].map((src, i) => (
            <div
              key={src}
              className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(67,59,178,0.2)] transition-transform hover:-translate-y-1"
            >
              <ZoomableImage
                src={src}
                alt={`TGEX 2026 promo graphic ${i + 1}`}
                width={640}
                height={640}
                className="h-auto w-full object-cover"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── EVENT ALBUM TEASER ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-tgex-yellow/40 bg-tgex-navy/60 p-8 text-center shadow-[0_0_60px_rgba(247,202,102,0.15)]">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 -z-0" aria-hidden>
            <div className="absolute left-1/3 top-0 h-48 w-48 rounded-full bg-tgex-yellow/10 blur-[60px]" />
            <div className="absolute right-1/3 bottom-0 h-48 w-48 rounded-full bg-tgex-magenta/10 blur-[60px]" />
          </div>
          <div className="relative z-10">
            <span className="inline-block rounded-full border border-tgex-yellow/50 bg-tgex-yellow/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">
              Event Album
            </span>
            <h2 className="mt-3 font-bungee text-3xl uppercase text-white sm:text-4xl">
              Relive The Memories
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-tgex-light/70">
              Browse photos and highlights from TGEX 2026. Two days, countless moments, one unforgettable multiverse.
            </p>
            <div className="mt-6">
              <Link
                href="/tgex/album"
                className="inline-flex items-center gap-2 rounded-full bg-tgex-yellow px-8 py-3 font-bungee text-sm uppercase tracking-wider text-tgex-dark shadow-[0_0_24px_rgba(247,202,102,0.5)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(247,202,102,0.7)]"
              >
                📸 View Event Album
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rift separator ─────────────────────────────────────────────── */}
      <div className="rift-line mx-auto max-w-7xl px-4 sm:px-8" aria-hidden />

      {/* ─── EVENT STATS ───────────────────────────────────────────────── */}
      <section ref={statsRef} className="stagger-children mx-auto grid w-full max-w-7xl grid-cols-2 gap-3 px-4 py-8 sm:grid-cols-4 sm:px-8">
        {[
          { stat: "10th", label: "Anniversary", color: "text-tgex-yellow", extra: "rgb-glow",    counter: null },
          { stat: "2",    label: "Days",         color: "text-tgex-pink",   extra: "",            counter: { value: 2 } },
          { stat: "10+",  label: "Tournaments",  color: "text-tgex-teal",   extra: "",            counter: { value: 10, suffix: "+" } },
          { stat: "∞",    label: "Universes",    color: "text-tgex-coral",  extra: "spin-border", counter: null },
        ].map(({ stat, label, color, extra, counter }) => (
          <div
            key={label}
            className={`holographic-card holo-card rounded-xl border border-white/10 bg-tgex-navy/50 py-6 text-center transition-all hover:-translate-y-1 hover:brightness-110 ${extra}`}
          >
            <p className={`neon-flicker font-bungee text-4xl sm:text-5xl ${color}`} style={{ "--delay": "1s" } as React.CSSProperties}>
              {counter ? (
                <AnimatedCounter value={counter.value} suffix={counter.suffix ?? ""} />
              ) : stat}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-tgex-light/80">{label}</p>
          </div>
        ))}
      </section>

    </div>
  );
}
