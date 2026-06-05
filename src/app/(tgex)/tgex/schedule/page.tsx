import type { Metadata } from "next";
import Image from "next/image";
import ScheduleGrid from "@/components/tgex/schedule/schedule-grid";
import { Reveal } from "@/components/tgex/reveal";

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "Full event schedule for TGEX 2026 at UCSD Price Center, May 30–31. Browse panels, tournaments, and activities by venue.",
};

export default function SchedulePage() {
  return (
    <div data-schedule-page="true" className="flex h-full min-h-0 w-full flex-col bg-tgex-dark font-lexend">
      {/* ── Enhanced compact header ───────────────────────────── */}
      <Reveal className="relative flex-shrink-0 overflow-hidden border-b border-white/10">
        {/* Animated backgrounds */}
        <div className="cyber-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />
        <div className="aurora-layer pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        {/* Subtle right-edge glow */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-32"
          style={{
            background:
              "linear-gradient(to left, rgba(255,29,111,0.12), transparent)",
          }}
          aria-hidden
        />

        {/* Content row */}
        <div className="relative flex items-center justify-between gap-2 px-3 py-1.5 sm:px-4 sm:py-2">
          {/* Left: title + date pill */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline gap-3">
              <h1 className="text-shimmer font-bungee text-2xl uppercase tracking-wide sm:text-3xl">
                Event Schedule
              </h1>
              {/* Spinning neon border date badge */}
              <span className="spin-border hidden shrink-0 rounded-full px-2.5 py-0.5 font-bungee text-[10px] uppercase tracking-widest text-white/80 sm:inline-flex">
                May 30–31
              </span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tgex-light/35 sm:text-[11px]">
              UCSD Price Center · Noon – 8 PM
            </p>
          </div>

          {/* Right: mascot peeking over the bottom edge */}
          <div
            className="pointer-events-none relative -mb-4 h-14 w-10 shrink-0 sm:-mb-6 sm:h-20 sm:w-14"
            aria-hidden
          >
            <Image
              src="/mascots/byte.png"
              alt=""
              fill
              className="object-contain object-bottom drop-shadow-[0_0_16px_rgba(71,169,155,0.6)]"
              sizes="56px"
            />
          </div>
        </div>
      </Reveal>

      {/* ── Main schedule area ───────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1.5 sm:px-3 sm:py-2 lg:overflow-hidden">
        <ScheduleGrid />
      </div>
    </div>
  );
}