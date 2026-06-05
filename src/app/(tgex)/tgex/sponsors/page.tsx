import type { Metadata } from "next";
import Image from "next/image";
import sponsorsData from "@/data/tgex/sponsors.json";
import { Reveal } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Sponsors",
  description:
    "Meet the confirmed sponsors powering TGEX 2026, with direct links to each company's website.",
};

type Sponsor = {
  name: string;
  tier: "Legendary" | "Diamond" | "Gold" | "Silver" | "DONOR";
  website: string;
  logoDomain: string;
  logoPath?: string;
  logoFit?: "wide" | "icon";
  logoSurface?: "light" | "dark";
};

const sponsors = sponsorsData as Sponsor[];

const tierStyles: Record<
  Sponsor["tier"],
  { label: string; glow: string; border: string; badge: string; headerColor: string; cardExtra: string }
> = {
  Legendary: {
    label: "Legendary",
    glow: "shadow-[0_0_38px_rgba(255,29,111,0.55)]",
    border: "border-tgex-magenta/70",
    badge: "bg-tgex-magenta/20 text-tgex-magenta border-tgex-magenta/40",
    headerColor: "text-tgex-magenta",
    cardExtra: "rgb-glow",
  },
  Diamond: {
    label: "Diamond",
    glow: "shadow-[0_0_38px_rgba(71,169,155,0.55)]",
    border: "border-tgex-teal/70",
    badge: "bg-tgex-teal/20 text-tgex-teal border-tgex-teal/40",
    headerColor: "text-tgex-teal",
    cardExtra: "spin-border",
  },
  Gold: {
    label: "Gold",
    glow: "shadow-[0_0_38px_rgba(247,202,102,0.45)]",
    border: "border-tgex-yellow/70",
    badge: "bg-tgex-yellow/20 text-tgex-yellow border-tgex-yellow/40",
    headerColor: "text-tgex-yellow",
    cardExtra: "",
  },
  Silver: {
    label: "Silver",
    glow: "shadow-[0_0_30px_rgba(255,255,255,0.22)]",
    border: "border-white/30",
    badge: "bg-white/10 text-white border-white/25",
    headerColor: "text-tgex-light",
    cardExtra: "",
  },
  DONOR: {
    label: "Donor",
    glow: "shadow-[0_0_30px_rgba(67,59,178,0.5)]",
    border: "border-tgex-indigo/70",
    badge: "bg-tgex-indigo/20 text-tgex-light border-tgex-indigo/40",
    headerColor: "text-tgex-light",
    cardExtra: "",
  },
};

const tierOrder: Sponsor["tier"][] = ["Legendary", "Diamond", "Gold", "Silver", "DONOR"];

const stars = [
  { top: "12%", left: "6%",  dur: "2.2s", delay: "0s",   glyph: "✦" },
  { top: "55%", left: "12%", dur: "3.1s", delay: "0.7s",  glyph: "✧" },
  { top: "25%", left: "85%", dur: "2.7s", delay: "0.3s",  glyph: "★" },
  { top: "65%", left: "78%", dur: "3.5s", delay: "1.1s",  glyph: "✦" },
  { top: "8%",  left: "52%", dur: "2.0s", delay: "0.5s",  glyph: "◆" },
  { top: "80%", left: "35%", dur: "2.8s", delay: "1.4s",  glyph: "✧" },
  { top: "40%", left: "95%", dur: "3.3s", delay: "0.9s",  glyph: "✩" },
  { top: "90%", left: "60%", dur: "2.5s", delay: "0.2s",  glyph: "◇" },
];

export default function SponsorsPage() {
  const grouped = tierOrder
    .map((tier) => ({
      tier,
      ...tierStyles[tier],
      sponsors: sponsors.filter((s) => s.tier === tier),
    }))
    .filter((g) => g.sponsors.length > 0);

  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-8 font-lexend sm:px-6 sm:py-12">

      {/* ── Alt-universe mascots floating in background ─────────── */}
      {/* Flame Hood Tex — bottom-left */}
      <div
        className="pointer-events-none absolute -left-10 bottom-40 w-44 opacity-[0.12] sm:w-64 sm:opacity-[0.10]"
        aria-hidden
      >
        <Image
          src="/mascots/tex-flame.png"
          alt=""
          width={260}
          height={360}
          className="cosmic-float h-auto w-full"
          style={{
            "--dur": "11s", "--delay": "0.5s", "--rot": "-6deg",
            filter: "drop-shadow(0 0 28px rgba(233,89,58,0.8)) saturate(1.3)",
          } as React.CSSProperties}
        />
      </div>

      {/* Star Guardian Tex — right mid */}
      <div
        className="pointer-events-none absolute -right-6 top-1/3 w-36 opacity-[0.13] sm:w-56 sm:opacity-[0.10]"
        aria-hidden
      >
        <Image
          src="/mascots/tex-star-guardian.png"
          alt=""
          width={220}
          height={320}
          className="cosmic-float warp-flicker h-auto w-full"
          style={{
            "--dur": "9s", "--delay": "2s", "--rot": "5deg",
            filter: "drop-shadow(0 0 28px rgba(244,76,167,0.9)) hue-rotate(20deg)",
          } as React.CSSProperties}
        />
      </div>

      {/* Graffiti Tex — top-left */}
      <div
        className="pointer-events-none absolute -left-4 top-56 w-24 opacity-[0.15] sm:w-40 sm:opacity-[0.11]"
        aria-hidden
      >
        <Image
          src="/mascots/tex-graffiti.png"
          alt=""
          width={160}
          height={240}
          className="cosmic-float warp-flicker h-auto w-full"
          style={{
            "--dur": "13s", "--delay": "1s", "--rot": "8deg",
            filter: "drop-shadow(0 0 20px rgba(255,178,77,0.7)) saturate(1.2)",
          } as React.CSSProperties}
        />
      </div>

      {/* Xet — top-right looming presence */}
      <div
        className="pointer-events-none absolute -right-8 top-32 w-40 opacity-[0.09] sm:w-64 sm:opacity-[0.07]"
        aria-hidden
      >
        <Image
          src="/mascots/xet-full.png"
          alt=""
          width={260}
          height={360}
          className="cosmic-float h-auto w-full"
          style={{
            "--dur": "7s", "--delay": "0s",
            filter: "drop-shadow(0 0 40px #FF1D6F)",
          } as React.CSSProperties}
        />
      </div>

      {/* ── Floating sticker ornaments ──────────────────────────── */}
      <div className="pointer-events-none absolute -right-3 top-8 w-16 opacity-60 sm:w-24" aria-hidden>
        <Image
          src="/stickers/sticker-prize.png"
          alt=""
          width={96}
          height={96}
          className="sticker h-auto w-full"
          style={{ "--rot": "12deg", "--delay": "0s" } as React.CSSProperties}
        />
      </div>
      <div className="pointer-events-none absolute -left-2 top-48 w-14 opacity-50 sm:w-20" aria-hidden>
        <Image
          src="/stickers/sticker-sabi.png"
          alt=""
          width={80}
          height={80}
          className="sticker h-auto w-full"
          style={{ "--rot": "-10deg", "--delay": "1.2s" } as React.CSSProperties}
        />
      </div>
      <div className="pointer-events-none absolute right-2 bottom-60 w-12 opacity-45 sm:w-18" aria-hidden>
        <Image
          src="/stickers/sticker-badge.png"
          alt=""
          width={72}
          height={72}
          className="sticker h-auto w-full"
          style={{ "--rot": "-14deg", "--delay": "0.8s" } as React.CSSProperties}
        />
      </div>
      <div className="pointer-events-none absolute left-2 bottom-32 w-12 opacity-50 sm:w-16" aria-hidden>
        <Image
          src="/stickers/sticker-star.png"
          alt=""
          width={64}
          height={64}
          className="sticker h-auto w-full"
          style={{ "--rot": "18deg", "--delay": "2s" } as React.CSSProperties}
        />
      </div>

      {/* ── Header ──────────────────────────────────────────────── */}
      <Reveal className="mb-14 flex flex-col items-center text-center" variant="fadeIn">
        {/* Starfield */}
        <div className="pointer-events-none relative mx-auto mb-4 h-12 w-full" aria-hidden>
          {stars.map((s, i) => (
            <span
              key={i}
              className="animate-twinkle absolute text-tgex-yellow"
              style={{
                top: s.top, left: s.left,
                fontSize: i % 3 === 0 ? "1.2rem" : i % 2 === 0 ? "0.9rem" : "1rem",
                "--dur": s.dur, "--delay": s.delay,
              } as React.CSSProperties}
            >
              {s.glyph}
            </span>
          ))}
        </div>

        {/* Portal ring behind the badge */}
        <div className="relative mb-1 flex items-center justify-center">
          <div
            className="portal-pulse pointer-events-none absolute"
            aria-hidden
            style={{ width: 200, height: 200 }}
          >
            <div className="portal-ring h-full w-full opacity-20" />
          </div>
          <div
            className="portal-pulse pointer-events-none absolute"
            aria-hidden
            style={{ width: 160, height: 160, animationDelay: "1.5s" }}
          >
            <div className="portal-ring-slow h-full w-full opacity-15" />
          </div>

          <span className="relative z-10 rounded-full border border-tgex-magenta/50 bg-tgex-magenta/15 px-5 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-pink">
            Powering TGEX 2026
          </span>
        </div>

        <h1
          className="neon-underline mt-3 font-bungee text-4xl uppercase text-white sm:text-5xl"
          data-text="Sponsors"
        >
          <LetterDrop text="Sponsors" />
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-tgex-light/80">
          The companies making TGEX 2026 possible — click any to visit their site.
        </p>
      </Reveal>

      {/* ── Sponsor logo marquee strip ───────────────────────────── */}
      <Reveal className="mb-10 overflow-hidden rounded-2xl border border-white/10 bg-tgex-dark/50 py-3" delay={0.06} variant="fadeIn">
        <div className="flex items-center gap-6 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="marquee-track flex shrink-0 items-center gap-10 pr-10" aria-hidden>
            {[...sponsors, ...sponsors].map((s, i) => (
              <span key={i} className="shrink-0 font-bungee text-sm uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Tier sections ───────────────────────────────────────── */}
      <section className="space-y-12">
        {grouped.map((group, gi) => (
          <div key={group.tier}>

            <Reveal delay={gi * 0.09} variant="fadeIn">
              {/* Tier label row — more dramatic */}
              <div className="mb-8 flex items-center justify-center gap-4">
                <div className={`h-px flex-1 bg-gradient-to-r from-transparent to-current opacity-40 ${group.headerColor}`} />
                <div className="relative flex items-center justify-center">
                  {/* Glow ring behind badge for top tiers */}
                  {(group.tier === "Legendary" || group.tier === "Diamond") && (
                    <div className={`pointer-events-none absolute inset-0 scale-150 rounded-full blur-xl opacity-30 ${group.tier === "Legendary" ? "bg-tgex-magenta" : "bg-tgex-teal"}`} aria-hidden />
                  )}
                  <span className={`relative z-10 inline-flex items-center gap-2 rounded-full border px-6 py-2 font-bungee text-base uppercase tracking-widest ${group.badge}`}>
                    {group.tier === "Legendary" && <span aria-hidden>★</span>}
                    {group.label}
                    {group.tier === "Legendary" && <span aria-hidden>★</span>}
                  </span>
                </div>
                <div className={`h-px flex-1 bg-gradient-to-l from-transparent to-current opacity-40 ${group.headerColor}`} />
              </div>

              {/* Cards — Legendary gets showcase treatment */}
              <ul
                className={`stagger-children grid justify-items-center gap-5 ${
                  group.tier === "Legendary"
                    ? "mx-auto max-w-2xl grid-cols-1 sm:grid-cols-2"
                    : group.tier === "Diamond" && group.sponsors.length === 1
                    ? "mx-auto max-w-sm grid-cols-1"
                    : group.tier === "Diamond"
                    ? "mx-auto max-w-4xl grid-cols-2 sm:grid-cols-2 lg:grid-cols-3"
                    : group.sponsors.length === 1
                    ? "mx-auto max-w-sm"
                    : group.sponsors.length === 2
                    ? "mx-auto max-w-sm grid-cols-2"
                    : "mx-auto max-w-6xl grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                }`}
              >
                {group.sponsors.map((sponsor) => {
                  const initials = sponsor.name
                    .split(" ")
                    .filter(Boolean)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const isLight = sponsor.logoSurface === "light";
                  const isLegendary = group.tier === "Legendary";
                  const isDiamond = group.tier === "Diamond";

                  return (
                    <li key={sponsor.name} className="w-full">
                      <a
                        href={sponsor.website}
                        target="_blank"
                        rel="noreferrer"
                        className={`holographic-card holo-card group flex flex-col items-center rounded-2xl border bg-tgex-navy/40 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:brightness-115 ${group.border} ${group.glow} ${group.cardExtra} ${isLegendary ? "p-6" : isDiamond ? "p-5" : "p-4"}`}
                      >
                        {/* Legendary scan effect */}
                        {isLegendary && (
                          <div className="scan-effect pointer-events-none absolute inset-0 rounded-2xl opacity-20" aria-hidden />
                        )}

                        {/* Logo plate */}
                        <div
                          className={`relative overflow-hidden rounded-xl transition-transform group-hover:scale-105 ${
                            isLight
                              ? "bg-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]"
                              : "bg-tgex-dark/30"
                          } ${
                            isLegendary
                              ? "mb-4 h-24 w-full"
                              : isDiamond
                              ? "mb-3 h-20 w-full"
                              : sponsor.logoFit === "icon"
                              ? "mb-3 h-20 w-20"
                              : "mb-3 h-16 w-full"
                          }`}
                        >
                          {sponsor.logoPath ? (
                            <Image
                              src={sponsor.logoPath}
                              alt={`${sponsor.name} logo`}
                              fill
                              sizes="(max-width:640px) 40vw, 200px"
                              className="object-contain p-3"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center font-bungee text-2xl text-white/60">
                              {initials}
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <p className={`truncate font-semibold text-white/90 transition-colors ${isLegendary ? "text-base" : "text-sm"}`}>
                          {sponsor.name}
                        </p>

                        {/* Legendary: domain hint */}
                        {isLegendary && (
                          <p className="mt-1 text-xs text-white/35">{sponsor.logoDomain}</p>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          </div>
        ))}
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <Reveal className="mt-14 text-center" delay={0.15} variant="fadeIn">
        <p className="neon-flicker font-bungee text-2xl uppercase text-tgex-teal sm:text-3xl">
          Sponsor TGEX 2027?
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-tgex-light/70">
          Partnership applications open after TGEX 2026. Reach out for booth, stage, and
          tournament packages.
        </p>
      </Reveal>
    </div>
  );
}
