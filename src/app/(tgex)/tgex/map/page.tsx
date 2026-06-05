import type { Metadata } from "next";
import Image from "next/image";
import ZoomableImage from "@/components/tgex/zoomable-image";
import BuildingMap from "@/components/tgex/map/building-map";
import VenueMapView from "@/components/tgex/map/map-view";
import { Reveal } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Navigate Price Center during TGEX 2026. Explore an interactive 3D floor map with all venues, stages, and room locations.",
};

export default function VenueMapPage() {
  return (
    <div className="relative w-full overflow-x-hidden font-lexend">
      {/* ── Ambient background ───────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="aurora-layer absolute inset-0 opacity-40" />
        <div className="cyber-grid absolute inset-0 opacity-10" />
      </div>

      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="relative mb-12 overflow-hidden border-b border-white/10 bg-gradient-to-b from-tgex-dark/90 to-transparent pb-10 pt-8 sm:pt-12">
        {/* Decorative frame — top right corner */}
        <div className="pointer-events-none absolute -right-8 -top-8 w-52 opacity-[0.07] sm:w-72" aria-hidden>
          <Image
            src="/frames/frame-fire.png"
            alt=""
            width={400}
            height={400}
            className="h-auto w-full rotate-12"
          />
        </div>

        {/* Decorative frame — bottom left */}
        <div className="pointer-events-none absolute -bottom-4 -left-6 w-40 opacity-[0.06] sm:w-56" aria-hidden>
          <Image
            src="/frames/frame-star-guardian.png"
            alt=""
            width={300}
            height={300}
            className="h-auto w-full -rotate-12"
          />
        </div>

        <div className="relative mx-auto flex max-w-6xl items-end justify-between gap-6 px-4 sm:px-6">
          {/* Text content */}
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-tgex-teal/40 bg-tgex-teal/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.25em] text-tgex-teal">
                UCSD Price Center · May 30–31
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-3 font-bungee text-5xl uppercase tracking-wide sm:text-6xl lg:text-7xl">
                <LetterDrop text="Venue" className="text-white" />
                <br />
                <LetterDrop text="Map" className="text-shimmer" />
              </h1>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-tgex-light/65">
                Price Center has 4 floors of gaming, panels, stages & more.
                Tap a floor in the 3D map to explore each level.
              </p>
            </Reveal>

            {/* Quick floor badges */}
            <Reveal delay={0.2}>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: "L1 · Theater", color: "#47A99B" },
                  { label: "L2 · Main Floor", color: "#F7CA66" },
                  { label: "L3 · Warren", color: "#0EA5E9" },
                  { label: "L4 · Forum", color: "#6366F1" },
                ].map((b) => (
                  <span
                    key={b.label}
                    className="rounded-full px-3 py-1 font-bungee text-xs uppercase tracking-wide"
                    style={{
                      color: b.color,
                      background: b.color + "18",
                      border: `1px solid ${b.color}40`,
                    }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Mascot — float-animating */}
          <Reveal delay={0.1} variant="fadeIn">
            <div className="relative -mb-6 h-40 w-28 flex-shrink-0 sm:-mb-10 sm:h-56 sm:w-40 lg:h-64 lg:w-48">
              <Image
                src="/mascots/byte-full.png"
                alt="Byte the TGEX mascot"
                fill
                className="float-animation object-contain object-bottom drop-shadow-[0_0_30px_rgba(71,169,155,0.5)]"
              />
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl space-y-20 px-4 pb-24 sm:px-6">
        {/* 3D Floor Map */}
        <Reveal variant="fadeIn" delay={0.08}>
          <section
            className="rounded-3xl border border-white/10 p-6 shadow-[0_0_80px_rgba(71,169,155,0.08)] sm:p-8"
            style={{
              background:
                "linear-gradient(135deg, rgba(71,169,155,0.06) 0%, rgba(10,3,20,0.85) 60%)",
            }}
          >
            <BuildingMap />
          </section>
        </Reveal>

        {/* Floor plan images */}
        <section>
          <Reveal>
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <h2 className="font-bungee text-sm uppercase tracking-[0.25em] text-tgex-light/50">
                Floor Plans
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </Reveal>

          <div className="flex flex-col gap-6">
            {[
              { src: "/TGEX_East_Ballrom.png", alt: "TGEX 2026 — East Ballroom Floor Plan", label: "East Ballroom" },
              { src: "/TGEX_West_Ballroom.png", alt: "TGEX 2026 — West Ballroom Floor Plan", label: "West Ballroom" },
            ].map(({ src, alt, label }, i) => (
              <Reveal key={label} delay={i * 0.08} variant="fadeIn">
                <div className="overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_80px_rgba(0,0,0,0.5)]">
                  <p className="border-b border-white/10 bg-tgex-navy/60 px-5 py-2.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-light/50">
                    {label}
                  </p>
                  <ZoomableImage
                    src={src}
                    alt={alt}
                    width={1366}
                    height={768}
                    className="h-auto w-full"
                  />
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} variant="fadeIn">
            <p className="mt-4 text-center text-xs text-tgex-light/35">
              Tap any map to zoom · Pinch to explore
            </p>
          </Reveal>
        </section>

        {/* Venue directory */}
        <section>
          <Reveal>
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <h2 className="font-bungee text-sm uppercase tracking-[0.25em] text-tgex-light/50">
                Venue Directory
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </Reveal>
          <Reveal delay={0.06} variant="fadeIn">
            <VenueMapView />
          </Reveal>
        </section>

        {/* Event posters */}
        <section>
          <Reveal>
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <h2 className="font-bungee text-sm uppercase tracking-[0.25em] text-tgex-light/50">
                Official Posters
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </Reveal>

          <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
            {[
              { src: "/posters/poster-front.png", alt: "TGEX 2026 — Official Flyer (Front)", label: "Front" },
              { src: "/posters/poster-back.png",  alt: "TGEX 2026 — Official Flyer (Back)",  label: "Back"  },
            ].map(({ src, alt, label }, i) => (
              <Reveal key={label} delay={i * 0.1}>
                <div className="group relative">
                  <div className="absolute -inset-2 rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: "radial-gradient(ellipse at center, rgba(255,29,111,0.2), transparent 70%)" }}
                  />
                  <div className="relative w-64 overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_80px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_24px_100px_rgba(0,0,0,0.7)] sm:w-72">
                    <ZoomableImage
                      src={src}
                      alt={alt}
                      width={420}
                      height={595}
                      className="h-auto w-full"
                    />
                  </div>
                  <p className="mt-3 text-center font-bungee text-xs uppercase tracking-[0.2em] text-tgex-light/40">
                    {label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Sticker accent */}
          <Reveal delay={0.2} variant="fadeIn">
            <div className="mt-10 flex items-center justify-center gap-3">
              <div className="pointer-events-none">
                <Image
                  src="/stickers/sticker-star.png"
                  alt=""
                  width={56}
                  height={56}
                  className="sticker h-auto w-14 opacity-70"
                  style={{ "--rot": "-8deg", "--delay": "0.3s" } as React.CSSProperties}
                  aria-hidden
                />
              </div>
              <p className="text-xs text-tgex-light/40">
                Tap any poster to zoom · Pinch to explore
              </p>
              <div className="pointer-events-none">
                <Image
                  src="/stickers/sticker-prize.png"
                  alt=""
                  width={56}
                  height={56}
                  className="sticker h-auto w-14 opacity-70"
                  style={{ "--rot": "10deg", "--delay": "0.8s" } as React.CSSProperties}
                  aria-hidden
                />
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
