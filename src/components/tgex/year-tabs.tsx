"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Map, Sparkles, HelpCircle, Trophy, Theater, Palette, Gamepad2, MoreHorizontal, ChevronDown, Users, Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type Tab = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const mainTabs: Tab[] = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Schedule", href: "/schedule", Icon: Clock },
  { label: "Map", href: "/map", Icon: Map },
  { label: "Sponsors", href: "/sponsors", Icon: Sparkles },
  { label: "FAQ", href: "/faq", Icon: HelpCircle },
];

const subTabs: Tab[] = [
  { label: "Divisions", href: "/divisions", Icon: Users },
  { label: "Tournaments", href: "/tournaments", Icon: Trophy },
  { label: "Cosplay Contest", href: "/cosplay-contest", Icon: Theater },
  { label: "Universes", href: "/universes", Icon: Palette },
  { label: "Indie Games", href: "/indie-games", Icon: Gamepad2 },
  { label: "Scavenger Hunt", href: "/scavenger-hunt", Icon: Search },
];

export default function YearTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreOpen]);

  return (
    <div className="flex items-center gap-1.5">
      <ul className="flex justify-center gap-1.5">
        {mainTabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.Icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold tracking-wide transition-all font-lexend whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tgex-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-tgex-dark",
                  isActive
                    ? "border-tgex-yellow bg-tgex-yellow text-tgex-dark shadow-[0_0_20px_rgba(247,202,102,0.6)]"
                    : "border-white/20 bg-white/5 text-white hover:border-tgex-teal hover:text-tgex-teal hover:bg-white/10",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={18} className="flex-shrink-0" aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* More Dropdown - Desktop */}
      <div ref={moreRef} className="relative">
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={[
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold tracking-wide transition-all font-lexend whitespace-nowrap",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tgex-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-tgex-dark",
            moreOpen
              ? "border-tgex-indigo bg-tgex-indigo/20 text-tgex-indigo shadow-[0_0_20px_rgba(102,51,153,0.4)]"
              : "border-white/20 bg-white/5 text-white hover:border-tgex-teal hover:text-tgex-teal hover:bg-white/10",
          ].join(" ")}
          aria-label="More options"
          aria-expanded={moreOpen}
        >
          <span>More</span>
          <ChevronDown
            size={16}
            className="flex-shrink-0 transition-transform"
            style={{ transform: moreOpen ? "rotate(180deg)" : "rotate(0)" }}
            aria-hidden
          />
        </button>

        {/* Dropdown Menu */}
        {moreOpen && (
          <div className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-tgex-indigo/50 bg-tgex-dark/95 backdrop-blur-md shadow-[0_8px_32px_rgba(102,51,153,0.3)] z-50">
            <ul className="py-2">
              {subTabs.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.Icon;

                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-sm transition-all",
                        isActive
                          ? "bg-tgex-indigo/30 text-tgex-indigo font-semibold"
                          : "text-white/80 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      <Icon size={16} className="flex-shrink-0" aria-hidden />
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileNavbar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="TGEX 2026 mobile navigation"
        className="dock-glow fixed bottom-0 left-0 right-0 z-50 border-t border-tgex-magenta/40 bg-tgex-dark/95 px-1 sm:px-2 py-1.5 sm:py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md xl:hidden"
      >
        <ul className="mx-auto grid w-full grid-cols-6 gap-0.5 sm:gap-1">
          {mainTabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.Icon;

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={[
                    "flex h-14 sm:h-16 flex-col items-center justify-center gap-1 rounded-lg px-0.5 sm:px-1 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-semibold leading-tight transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tgex-yellow",
                    isActive
                      ? "bg-tgex-yellow/90 text-tgex-dark shadow-[0_0_22px_rgba(247,202,102,0.65)]"
                      : "bg-white/5 text-white hover:bg-white/10",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} className="sm:size-[20px]" aria-hidden />
                  <span className="line-clamp-1">{tab.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={[
                "flex h-14 sm:h-16 w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 sm:px-1 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-semibold leading-tight transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tgex-yellow",
                moreOpen
                  ? "bg-tgex-indigo/90 text-white shadow-[0_0_22px_rgba(102,51,153,0.65)]"
                  : "bg-white/5 text-white hover:bg-white/10",
              ].join(" ")}
              aria-label="More navigation options"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={18} className="sm:size-[20px]" aria-hidden />
              <span className="line-clamp-1">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* More Menu Modal */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-[58] bg-black/50 xl:hidden"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1 right-1 sm:left-2 sm:right-2 z-[59] rounded-lg border border-tgex-indigo/50 bg-tgex-dark/95 p-2 sm:p-3 backdrop-blur-md xl:hidden max-h-[50vh] overflow-y-auto">
            <h2 className="mb-2 font-bungee text-xs sm:text-sm uppercase text-tgex-indigo line-clamp-1">
              Explore More
            </h2>
            <ul className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {subTabs.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.Icon;

                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={[
                        "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 sm:px-3 py-2 sm:py-3 text-center text-[11px] sm:text-xs font-semibold transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tgex-yellow",
                        isActive
                          ? "border-tgex-indigo bg-tgex-indigo/30 text-tgex-indigo shadow-[0_0_16px_rgba(102,51,153,0.4)]"
                          : "border-white/20 bg-white/5 text-white hover:border-tgex-indigo/50 hover:bg-white/10",
                      ].join(" ")}
                    >
                      <Icon size={18} className="sm:size-[20px] flex-shrink-0" aria-hidden />
                      <span className="line-clamp-2">{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
