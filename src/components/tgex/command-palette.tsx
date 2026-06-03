"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { createPortal } from "react-dom";

type SearchItem = {
  id: string;
  name: string;
  href: string;
  category: string;
  icon?: string;
};

const searchItems: SearchItem[] = [
  // Main Pages
  { id: "main-home", name: "Home", href: "/#home", category: "Main" },
  { id: "main-schedule", name: "Schedule", href: "/schedule", category: "Main" },
  { id: "main-map", name: "Venue Map", href: "/map", category: "Main" },
  { id: "main-sponsors", name: "Sponsors", href: "/#sponsors", category: "Main" },
  { id: "main-faq", name: "FAQ", href: "/faq", category: "Main" },
  // Events & Activities
  { id: "event-tournaments", name: "Tournaments", href: "/tournaments", category: "Events" },
  { id: "event-cosplay-contest", name: "Cosplay Contest", href: "/cosplay-contest", category: "Events" },
  { id: "event-scavenger-hunt", name: "Scavenger Hunt", href: "/scavenger-hunt", category: "Events" },
  { id: "event-divisions", name: "Community Divisions", href: "/divisions", category: "Events" },
  { id: "panel-voice-acting", name: "Voice Acting Panel", href: "/panels/voice-acting-panel", category: "Panels" },
  { id: "panel-content-creator", name: "Content Creator Panel", href: "/panels/content-creator-panel", category: "Panels" },
  { id: "panel-careers-riot", name: "Careers at Riot", href: "/panels/careers-at-riot", category: "Panels" },
  { id: "panel-indie-games", name: "Indie Games Showcase", href: "/panels/indie-games-showcase", category: "Panels" },
  // Collections
  { id: "collection-universes", name: "Alternate Universes", href: "/#universes", category: "Collections" },
  { id: "collection-divisions", name: "Divisions on Home", href: "/#divisions", category: "Collections" },
  // Indie
  { id: "collection-indie", name: "Indie Games", href: "/#indie-games", category: "Collections" },
  { id: "studio-supergiant", name: "Supergiant Games", href: "/indie-games/supergiant-games", category: "Studios" },
  { id: "studio-behemoth", name: "The Behemoth", href: "/indie-games/the-behemoth", category: "Studios" },
  { id: "studio-brace", name: "Brace Yourself Games", href: "/indie-games/brace-yourself-games", category: "Studios" },
  { id: "studio-squid", name: "Giant Squid", href: "/indie-games/giant-squid", category: "Studios" },
  { id: "studio-divewhale", name: "DiveWhaleCo", href: "/indie-games/divewhale-co", category: "Studios" },
  { id: "studio-shrimp", name: "ShrimpFriedRice Games", href: "/indie-games/shrimp-fried-rice-games", category: "Studios" },
  // Divisions
  { id: "division-league-tft", name: "Triton League & TFT", href: "/divisions/triton-league-and-tft", category: "Divisions" },
  { id: "division-splatoon", name: "Triton Splatoon", href: "/divisions/triton-splatoon", category: "Divisions" },
  { id: "division-melee", name: "Triton Melee", href: "/divisions/triton-melee", category: "Divisions" },
  { id: "division-valorant", name: "Triton Valorant", href: "/divisions/triton-valorant", category: "Divisions" },
  { id: "division-fighters", name: "Triton Fighters", href: "/divisions/triton-fighters", category: "Divisions" },
  { id: "division-pokemon", name: "Triton Pokemon League", href: "/divisions/triton-pokemon-league", category: "Divisions" },
  { id: "division-rivals", name: "Triton Rivals", href: "/divisions/triton-rivals", category: "Divisions" },
  { id: "division-orchestra", name: "Intermission Orchestra", href: "/divisions/intermission-orchestra", category: "Divisions" },
  { id: "division-smash", name: "Triton Smash", href: "/divisions/triton-smash", category: "Divisions" },
  { id: "division-rhythm", name: "Dance and Rhythm Game Club", href: "/divisions/dance-and-rhythm-game-club", category: "Divisions" },
  { id: "division-roblox", name: "Roblox + RBXDev at UCSD", href: "/divisions/roblox-and-rbxdev-at-ucsd", category: "Divisions" },
  { id: "division-mario-kart", name: "Triton Mario Kart", href: "/divisions/triton-mario-kart", category: "Divisions" },
  { id: "division-minecraft", name: "Triton Minecraft", href: "/divisions/triton-minecraft", category: "Divisions" },
  // Tournaments
  { id: "tournament-neptune", name: "Neptune Valorant Tournament", href: "/tournament/neptune-valorant-tournament", category: "Tournaments" },
  { id: "tournament-lol", name: "League of Legends 5v5", href: "/tournament/league-of-legends-5v5", category: "Tournaments" },
  { id: "tournament-mario", name: "Mario Kart Finals", href: "/tournament/mario-kart-finals", category: "Tournaments" },
  { id: "tournament-fighters", name: "Fighters Finals", href: "/tournament/fighters-finals", category: "Tournaments" },
  { id: "tournament-high-tide", name: "High Tide Valorant", href: "/tournament/high-tide-valorant", category: "Tournaments" },
  { id: "tournament-aram", name: "1v1 ARAM", href: "/tournament/1v1-aram", category: "Tournaments" },
];

type CategoryGroup = {
  [key: string]: SearchItem[];
};

export default function CommandPalette() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopListRef = useRef<HTMLDivElement>(null);
  const mobileListRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSelect(item: SearchItem) {
    const [rawPath, rawHash] = item.href.split("#");
    const targetPath = rawPath || "/";
    const hash = rawHash?.trim();

    if (hash && pathname === targetPath) {
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `${targetPath}#${hash}`);
        setOpen(false);
        return;
      }
    }

    router.push(item.href);
    setOpen(false);
  }

  // Close search when navigating to a different page
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Group results by category
  const filtered = searchItems.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  const grouped: CategoryGroup = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as CategoryGroup);

  const flatResults = Object.values(grouped).flat();

  // Open on Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
        setQuery("");
      }
      if (!open) {
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s < flatResults.length - 1 ? s + 1 : s));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s > 0 ? s - 1 : s));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flatResults[selected];
        if (item) {
          handleSelect(item);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatResults, selected]);

  // Focus input when opened and reset selected index
  useEffect(() => {
    if (open) {
      if (window.matchMedia("(min-width: 768px)").matches) {
        desktopInputRef.current?.focus();
      } else {
        mobileInputRef.current?.focus();
      }
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    const desktopSelected = desktopListRef.current?.querySelector('[data-selected="true"]');
    desktopSelected?.scrollIntoView({ block: "nearest" });

    const mobileSelected = mobileListRef.current?.querySelector('[data-selected="true"]');
    mobileSelected?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const overlays =
    open && mounted
      ? createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[70] bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Desktop expanding search across header */}
            <div
              className={[
                "pointer-events-none fixed left-1/2 top-3 z-[90] hidden w-[calc(100%-3rem)] max-w-7xl -translate-x-1/2 origin-right transition-all duration-300 ease-out md:flex",
                open ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
              ].join(" ")}
            >
              <div className="pointer-events-auto w-full">
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-tgex-teal/50 bg-tgex-dark/95 px-4 shadow-[0_0_36px_rgba(71,169,155,0.35)] backdrop-blur-md">
                  <span className="relative grid h-8 w-8 place-items-center rounded-full border border-tgex-teal/45 bg-tgex-teal/15 shadow-[0_0_12px_rgba(71,169,155,0.45)]">
                    <Search size={16} className="text-tgex-teal" aria-hidden />
                    <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-tgex-pink shadow-[0_0_10px_rgba(244,76,167,0.9)]" aria-hidden />
                  </span>
                  <input
                    ref={desktopInputRef}
                    type="text"
                    placeholder="Search pages, events, universes, studios..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(0);
                    }}
                    className="flex-1 bg-transparent text-base text-white placeholder-white/35 outline-none"
                  />
                  <kbd className="rounded-full border border-white/20 px-2 py-1 text-[11px] font-semibold text-white/55">
                    ESC
                  </kbd>
                  <button
                    onClick={() => setOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-tgex-pink hover:text-white"
                    aria-label="Close"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>

                <div
                  ref={desktopListRef}
                  className="mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-tgex-teal/40 bg-tgex-dark/95 shadow-[0_10px_36px_rgba(0,0,0,0.5)]"
                >
                  {flatResults.length > 0 ? (
                    Object.entries(grouped).map(([category, items]) => (
                      <div key={category} className="border-b border-white/5 last:border-b-0">
                        <div className="sticky top-0 bg-tgex-dark/95 px-4 py-2 text-xs font-bungee uppercase text-tgex-teal/65">
                          {category}
                        </div>
                        {items.map((item) => {
                          const globalIdx = flatResults.indexOf(item);
                          return (
                            <button
                              key={item.id}
                              data-selected={globalIdx === selected}
                              onClick={() => handleSelect(item)}
                              className={[
                                "flex w-full items-center justify-between px-4 py-3 text-left transition-all",
                                globalIdx === selected
                                  ? "bg-tgex-teal/20 text-tgex-teal"
                                  : "text-white/80 hover:bg-white/5 hover:text-white",
                              ].join(" ")}
                            >
                              <span className="truncate text-sm">{item.name}</span>
                              {globalIdx === selected && (
                                <span className="ml-2 shrink-0 text-xs text-tgex-teal/70">⏎</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-white/40">
                      <p className="text-sm">No results found for &quot;{query}&quot;</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile dialog */}
            <div className="fixed left-2 right-2 top-2 bottom-24 z-[100] mx-auto flex w-auto max-w-none flex-col rounded-xl border border-tgex-teal/50 bg-tgex-dark/95 shadow-[0_0_40px_rgba(71,169,155,0.3)] backdrop-blur-md md:hidden">
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <Search size={18} className="text-tgex-teal" aria-hidden />
                <input
                  ref={mobileInputRef}
                  type="text"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(0);
                  }}
                  className="min-w-0 flex-1 bg-transparent text-base text-white placeholder-white/40 outline-none"
                />
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 text-white/60 transition-colors hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>

              <div
                ref={mobileListRef}
                className="min-h-0 flex-1 divide-y divide-white/10 overflow-y-auto"
              >
                {flatResults.length > 0 ? (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <div className="sticky top-0 bg-tgex-dark/80 px-4 py-2 text-xs font-bungee uppercase text-tgex-teal/60">
                        {category}
                      </div>
                      {items.map((item) => {
                        const globalIdx = flatResults.indexOf(item);
                        return (
                          <button
                            key={item.id}
                            data-selected={globalIdx === selected}
                            onClick={() => handleSelect(item)}
                            className={[
                              "flex w-full items-center justify-between px-4 py-3 text-left transition-all",
                              globalIdx === selected
                                ? "bg-tgex-teal/20 text-tgex-teal"
                                : "text-white/80 hover:bg-white/5 hover:text-white",
                            ].join(" ")}
                          >
                            <span className="truncate text-sm">{item.name}</span>
                            {globalIdx === selected && (
                              <span className="ml-2 shrink-0 text-xs text-tgex-teal/60">⏎</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-white/40">
                    <p className="text-sm">No results found for &quot;{query}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      {/* Search Button - Mobile (in header, < xl) */}
      <button
        onClick={() => setOpen(true)}
        className="xl:hidden p-1 sm:p-1.5 rounded-lg border border-white/20 bg-white/5 text-white hover:border-tgex-teal hover:bg-white/10 transition-all"
        aria-label="Search"
      >
        <Search size={16} className="sm:size-[18px]" aria-hidden />
      </button>

      {/* Search Button - Desktop (>= xl) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden xl:flex items-center gap-2 rounded-2xl border border-tgex-teal/35 bg-gradient-to-r from-[#10253A] to-[#1A2D45] px-4 py-3 text-sm font-semibold tracking-wide text-tgex-light/90 shadow-[0_0_14px_rgba(71,169,155,0.2)] transition-all hover:-translate-y-0.5 hover:border-tgex-teal hover:shadow-[0_0_22px_rgba(71,169,155,0.45)]"
        aria-label="Search (Cmd+K)"
      >
        <span className="relative grid h-7 w-7 place-items-center rounded-full border border-tgex-teal/45 bg-tgex-teal/15 shadow-[0_0_10px_rgba(71,169,155,0.4)]">
          <Search size={14} className="text-tgex-teal" aria-hidden />
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-tgex-pink shadow-[0_0_8px_rgba(244,76,167,0.8)]" aria-hidden />
        </span>
        <span className="hidden 2xl:inline">Search</span>
      </button>

      {overlays}
    </>
  );
}
