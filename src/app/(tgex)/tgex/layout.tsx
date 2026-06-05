import type { Metadata } from "next";
import { Lexend_Deca, Bungee } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import YearTabs, { MobileNavbar } from "@/components/tgex/year-tabs";
import CommandPalette from "@/components/tgex/command-palette";
import AnnouncementMarquee from "@/components/tgex/announcement-marquee";
import { Analytics } from "@vercel/analytics/next";
import "./tgex-globals.css";

const lexend = Lexend_Deca({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const bungee = Bungee({
  variable: "--font-bungee",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TGEX 2026 — Triton Gaming Expo",
    template: "%s | TGEX 2026",
  },
  description:
    "Triton Gaming Expo 2026 — The Multiverse. A two-day gaming convention at UCSD Price Center featuring panels, tournaments, creators, and special guests. May 30–31, 2026.",
  keywords: ["TGEX", "Triton Gaming Expo", "UCSD", "gaming convention", "esports", "anime", "2026"],
  openGraph: {
    title: "TGEX 2026 — Triton Gaming Expo",
    description:
      "A two-day gaming convention at UCSD Price Center. Panels, tournaments, creators, and guests. May 30–31, 2026.",
    siteName: "TGEX",
    type: "website",
  },
};

export default function TgexLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${lexend.variable} ${bungee.variable} cyber-grid relative antialiased flex min-h-screen flex-col overflow-x-hidden pt-12 sm:pt-14 xl:pt-28 xl:pb-0`}
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="aurora-layer pointer-events-none fixed inset-0 -z-10" aria-hidden />

      {/* ── Scrolling announcement ticker ─────────────────────── */}
      <AnnouncementMarquee />

      <header className="fixed top-0 left-0 right-0 z-[65] border-b border-tgex-magenta/50 bg-tgex-navy/85 shadow-[0_2px_30px_rgba(255,29,111,0.12)] backdrop-blur-md">
        {/* Mobile Header (single line) */}
        <div className="xl:hidden mx-auto grid w-full grid-cols-[auto_1fr_auto] items-center px-2 sm:px-3 gap-2 sm:gap-3 relative h-12 sm:h-14">
          {/* Left: Logo */}
          <Link href="/tgex" className="group shrink-0 p-1">
            <div className="relative shrink-0">
              <div className="portal-ring pointer-events-none absolute inset-0 scale-125 rounded-full opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
              <Image
                src="/icon/tgex_tg_logo.png"
                alt="TGEX Logo"
                width={48}
                height={48}
                className="relative h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 transition-transform group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_rgba(255,29,111,0.9)] flex-shrink-0"
              />
            </div>
          </Link>

          {/* Center: TGEX 2026 */}
          <p className="neon-flicker font-bungee text-sm sm:text-base leading-tight text-white text-center min-w-0 truncate overflow-hidden" style={{ "--delay": "2s" } as React.CSSProperties}>
            TGEX <span className="text-tgex-pink">2026</span>
          </p>

          {/* Right: Tickets + Search */}
          <div className="flex items-center justify-end gap-2.5 sm:gap-3">
            <a
              href="https://www.eventbrite.com/e/triton-gaming-expo-2026-tickets-1987295961718"
              target="_blank"
              rel="noreferrer"
              className="ticket-beacon rounded-full bg-tgex-magenta px-2 py-0.5 sm:px-2.5 sm:py-0.5 font-bungee text-[10px] sm:text-[11px] uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,29,111,0.55)] transition-all active:scale-95 whitespace-nowrap"
            >
              Tickets
            </a>
            <CommandPalette />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden xl:grid xl:grid-cols-[1fr_auto_1fr] mx-auto w-full max-w-[120rem] items-center px-8 2xl:px-14 gap-x-8 2xl:gap-x-14 h-28">
          {/* Logo & Branding */}
          <Link href="/tgex" className="group flex items-center gap-2.5 2xl:gap-3.5 justify-self-start">
            <div className="relative shrink-0">
              <div className="portal-ring pointer-events-none absolute inset-0 scale-125 rounded-full opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
              <Image
                src="/icon/tgex_tg_logo.png"
                alt="TGEX Logo"
                width={56}
                height={56}
                className="relative h-10 w-10 2xl:h-12 2xl:w-12 transition-transform group-hover:scale-110 group-hover:drop-shadow-[0_0_14px_rgba(255,29,111,0.9)] flex-shrink-0"
              />
            </div>
            <div className="min-w-0">
              <p className="neon-flicker font-bungee text-lg 2xl:text-xl leading-tight text-white whitespace-nowrap" style={{ "--delay": "2s" } as React.CSSProperties}>
                TGEX <span className="text-tgex-pink">2026</span>
              </p>
              <p className="font-lexend text-[11px] tracking-[0.18em] text-tgex-light/80 uppercase whitespace-nowrap hidden 2xl:block">
                Triton Gaming Expo
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="TGEX 2026 main navigation">
            <YearTabs />
          </nav>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <a
              href="https://www.eventbrite.com/e/triton-gaming-expo-2026-tickets-1987295961718"
              target="_blank"
              rel="noreferrer"
              className="ticket-beacon shrink-0 rounded-full bg-tgex-magenta px-4 py-2.5 font-bungee text-xs uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,29,111,0.55)] transition-all hover:scale-105 hover:shadow-[0_0_32px_rgba(255,29,111,0.8)] whitespace-nowrap"
            >
              Get Tickets
            </a>
            <CommandPalette />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 pb-28 xl:pb-0">{children}</main>

      <footer className="relative mt-8 mb-24 overflow-hidden border-t-2 border-tgex-indigo bg-tgex-navy py-8 sm:py-10 text-center font-lexend xl:mb-0">
        <div className="rift-line absolute top-0 left-0 right-0" aria-hidden />

        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-1/4 top-0 h-40 w-72 -translate-y-1/2 rounded-full bg-tgex-magenta/25 blur-3xl" />
          <div className="absolute right-1/4 top-0 h-40 w-72 -translate-y-1/2 rounded-full bg-tgex-teal/18 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-32 w-96 -translate-x-1/2 rounded-full bg-tgex-indigo/20 blur-3xl" />
        </div>

        <div className="relative z-10 px-3 sm:px-6">
          <Image
            src="/icon/tgex_tg_logo.png"
            alt="TGEX"
            width={96}
            height={96}
            className="mx-auto mb-3 sm:mb-4 h-16 sm:h-20 w-16 sm:w-20 object-contain opacity-90 drop-shadow-[0_0_18px_rgba(255,29,111,0.5)]"
          />
          <p className="mb-1 font-bungee text-base sm:text-lg uppercase tracking-widest text-tgex-yellow">
            Triton Gaming Expo
          </p>
          <p className="text-xs sm:text-sm text-tgex-light/60">10th Anniversary · May 30–31, 2026 · UCSD</p>

          {/* Social links */}
          <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 sm:gap-3 flex-wrap px-2 sm:px-0">
            {[
              {
                label: "Discord",
                href: "https://discord.gg/tritongaming",
                color: "hover:border-[#5865F2] hover:text-[#5865F2] hover:shadow-[0_0_16px_rgba(88,101,242,0.5)]",
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                ),
              },
              {
                label: "Instagram",
                href: "https://www.instagram.com/tritongamingsd/",
                color: "hover:border-[#E1306C] hover:text-[#E1306C] hover:shadow-[0_0_16px_rgba(225,48,108,0.5)]",
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                ),
              },
              {
                label: "X / Twitter",
                href: "https://x.com/tritongamingsd",
                color: "hover:border-white hover:text-white hover:shadow-[0_0_16px_rgba(255,255,255,0.3)]",
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.766l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                ),
              },
              {
                label: "Twitch",
                href: "https://www.twitch.tv/tritongaming",
                color: "hover:border-[#9146FF] hover:text-[#9146FF] hover:shadow-[0_0_16px_rgba(145,70,255,0.5)]",
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                  </svg>
                ),
              },
              {
                label: "Facebook",
                href: "https://www.facebook.com/tritonesports",
                color: "hover:border-[#1877F2] hover:text-[#1877F2] hover:shadow-[0_0_16px_rgba(24,119,242,0.5)]",
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                ),
              },
            ].map(({ label, href, color, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Triton Gaming on ${label}`}
                className={`flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 sm:px-4 py-2 text-xs font-semibold text-tgex-light/70 transition-all duration-200 hover:bg-white/10 ${color}`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </a>
            ))}
          </div>

          <p className="mt-6 text-xs text-tgex-light/70">
            Other years:{" "}
            <Link href="/tgex/2025" className="text-tgex-magenta/80 hover:text-tgex-magenta transition-colors">2025</Link>
            {" · "}
            <Link href="/tgex/2024" className="text-tgex-magenta/80 hover:text-tgex-magenta transition-colors">2024</Link>
          </p>
          <p className="mt-2 text-xs opacity-40">&copy; 2026 Triton Gaming. Based at UCSD.</p>
        </div>
      </footer>

      <MobileNavbar />
      <Analytics />
    </div>
  );
}
