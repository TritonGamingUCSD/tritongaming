"use client";

import { useState } from "react";
import { Building2, ChevronRight, MapPin } from "lucide-react";

// ── Floor data (sourced from UCSD University Centers: universitycenters.ucsd.edu) ──
// Floors ordered Level 1 → 4 so index 0 renders at the bottom of the 3D stack.

type FloorVenue = {
  name: string;
  url?: string;
  rooms: string[];
};

type FloorData = {
  level: 1 | 2 | 3 | 4;
  label: string;
  sublabel: string;
  name: string;
  color: string;
  glowHex: string;
  icon: string;
  venues: FloorVenue[];
};

const FLOORS: FloorData[] = [
  {
    level: 1,
    label: "Level 1",
    sublabel: "Price Center West",
    name: "Theater Level",
    color: "#47A99B",
    glowHex: "rgba(71,169,155,0.55)",
    icon: "🎭",
    venues: [
      {
        name: "PC Theater",
        url: "https://universitycenters.ucsd.edu/events-and-reservations/room-guide-pages/theater.html",
        rooms: [
          "So You Wanna Voice Act? — Day 1, 1–2 PM",
          "Content Creator Panel (Tuonto) — Day 1, 3:30–4:30 PM",
          "Bringing Your Favorite Characters to Life! — Day 2, 12:30–1:30 PM",

        ],
      },
    ],
  },
  {
    level: 2,
    label: "Level 2",
    sublabel: "Price Center East + West",
    name: "Main Event Floor",
    color: "#F7CA66",
    glowHex: "rgba(247,202,102,0.55)",
    icon: "⚡",
    venues: [
      {
        name: "Ballroom East",
        url: "https://universitycenters.ucsd.edu/events-and-reservations/room-guide-pages/ballroom-east.html",
        rooms: [
          "East Stage — TLTFT Showmatch, TIO Performance, Freeplay, OST Performance",
          "East Floor — Freeplay (2 PM–8 PM)",
          "Muir College Room — Red Bull Game Room & Racing Corner",
        ],
      },
      {
        name: "Ballroom West A+B",
        url: "https://universitycenters.ucsd.edu/events-and-reservations/room-guide-pages/ballroom-west-ab.html",
        rooms: [
          "West Stage — Performances, Panels, Opportunity Draws",
          "West Floor — Artist Alley · Meet & Greet Tables",
          "Dance and Rhythm Game Club",
        ],
      },
      {
        name: "College Rooms",
        url: "https://universitycenters.ucsd.edu/events-and-reservations/event-spaces-pages/meeting-rooms.html",
        rooms: [
          "Roosevelt (ERC) Room — Mario Kart 8 Friendlies",
          "Marshall College Room — Fighters (SF6, GGST)",
          "Red Shoe Room — Smash / Melee",
          "Bear Room — Smash / Melee",
        ],
      },
    ],
  },
  {
    level: 3,
    label: "Level 3",
    sublabel: "Price Center West",
    name: "Warren & Quiet Zone",
    color: "#0EA5E9",
    glowHex: "rgba(14,165,233,0.55)",
    icon: "🌿",
    venues: [
      {
        name: "Earl Warren Room",
        url: "https://universitycenters.ucsd.edu/events-and-reservations/room-guide-pages/warren-college-room.html",
        rooms: [
          "Cozy Game Room & Art Wall",          "Dating Sim",          "Rest & Recharge — power outlets, low-light area",
        ],
      },
    ],
  },
  {
    level: 4,
    label: "Level 4",
    sublabel: "Price Center East",
    name: "Forum Level",
    color: "#6366F1",
    glowHex: "rgba(99,102,241,0.55)",
    icon: "🏰",
    venues: [
      {
        name: "The Forum",
        url: "https://universitycenters.ucsd.edu/events-and-reservations/room-guide-pages/the-forum.html",
        rooms: [
          "Cosplay Café & Oshikatsu Café",

        ],
      },
    ],
  },
] ;

// Note: The Multipurpose Room (Panels venue) is in the
// Student Services Center — a separate building from Price Center.
// MPR: 3,828 sq ft · 259 cap (lecture style)

type FloorLevel = 1 | 2 | 3 | 4;

// ── Main component ────────────────────────────────────────────────────────────

export default function BuildingMap() {
  const [selected, setSelected] = useState<FloorLevel>(2);

  const selectedFloor = FLOORS.find((f) => f.level === selected)!;

  return (
    <div className="w-full font-lexend">
      {/* Section label */}
      <div className="mb-8 flex items-center gap-3">
        <Building2 className="h-5 w-5 text-tgex-teal" />
        <h2 className="font-bungee text-base uppercase tracking-[0.2em] text-tgex-light/80">
          Price Center — Floor Map
        </h2>
        <div className="h-px flex-1 bg-white/10" />
        <span className="rounded-full border border-tgex-teal/30 bg-tgex-teal/10 px-3 py-0.5 text-xs font-semibold text-tgex-teal">
          Interactive
        </span>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* ── Floor selector ──────────────────────────────────────── */}
        <div className="flex flex-shrink-0 flex-row flex-wrap justify-center gap-2 lg:flex-col">
          {[...FLOORS].reverse().map((floor) => {
            const isActive = floor.level === selected;
            return (
              <button
                key={floor.level}
                onClick={() => setSelected(floor.level)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                style={{
                  background: isActive
                    ? `${floor.color}18`
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isActive ? floor.color + "70" : "rgba(255,255,255,0.08)"
                  }`,
                  color: isActive ? floor.color : "rgba(255,255,255,0.50)",
                  boxShadow: isActive ? `0 0 20px ${floor.glowHex}` : "none",
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full transition-all"
                  style={{
                    backgroundColor: floor.color,
                    boxShadow: isActive ? `0 0 8px ${floor.color}` : "none",
                  }}
                />
                <span className="font-bungee text-xs uppercase tracking-wide">
                  L{floor.level}
                </span>
                <span className="text-xs font-medium leading-snug">
                  {floor.name}
                </span>
                <ChevronRight
                  className="ml-auto h-3.5 w-3.5"
                  style={{ opacity: isActive ? 1 : 0 }}
                />
              </button>
            );
          })}
        </div>

        {/* ── Floor Info Panel ────────────────────────────────────────── */}
        <div
          className="holographic-card flex-1 rounded-2xl border p-8 backdrop-blur-sm transition-all duration-500"
          style={{
            borderColor: `${selectedFloor.color}40`,
            background: `linear-gradient(135deg, ${selectedFloor.color}0f 0%, rgba(10,3,20,0.85) 60%)`,
            boxShadow: `0 0 60px ${selectedFloor.glowHex}, inset 0 0 40px ${selectedFloor.color}08`,
          }}
        >
          {/* Floor badge */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-3 py-0.5 font-bungee text-xs uppercase tracking-widest"
              style={{
                color: selectedFloor.color,
                borderColor: selectedFloor.color + "50",
                backgroundColor: selectedFloor.color + "15",
              }}
            >
              {selectedFloor.label}
            </span>
            <span className="text-xs text-white/40">{selectedFloor.sublabel}</span>
            <span className="text-lg">{selectedFloor.icon}</span>
          </div>

          {/* Floor name */}
          <h3
            className="mb-8 font-bungee text-2xl uppercase tracking-wide sm:text-3xl"
            style={{ color: selectedFloor.color }}
          >
            {selectedFloor.name}
          </h3>

          {/* Venues */}
          <div className="space-y-8">
            {selectedFloor.venues.map((venue) => (
              <div key={venue.name}>
                <div className="mb-4 flex items-center gap-2">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: selectedFloor.color + "cc" }}
                  />
                  {venue.url ? (
                    <a
                      href={venue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold uppercase tracking-wide underline-offset-2 hover:underline"
                      style={{ color: selectedFloor.color + "cc" }}
                    >
                      {venue.name}
                    </a>
                  ) : (
                    <p
                      className="text-sm font-bold uppercase tracking-wide"
                      style={{ color: selectedFloor.color + "cc" }}
                    >
                      {venue.name}
                    </p>
                  )}
                </div>
                <ul className="space-y-3 pl-5">
                  {venue.rooms.map((room) => (
                    <li
                      key={room}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-tgex-light/80"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: selectedFloor.color + "88" }}
                      />
                      {room}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Off-site venue notices */}
      <div className="mt-6 space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-tgex-magenta/25 bg-tgex-magenta/5 p-4">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-tgex-magenta/70" />
          <div>
            <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-tgex-magenta/80">
              Multipurpose Room — Panels Venue
            </p>
            <p className="text-xs text-tgex-light/55">
              Located in the{" "}
              <a
                href="https://universitycenters.ucsd.edu/events-and-reservations/room-guide-pages/multipurpose-room.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-tgex-magenta/80 underline underline-offset-2 hover:text-tgex-magenta"
              >
                Student Services Center
              </a>
              {" "}— a separate building from Price Center (3–4 min walk). Hosts: Careers @ Riot, Alumni Careers Panel, Indie Game Showcase, How to Get a Job in Games.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-tgex-pink/25 bg-tgex-pink/5 p-4">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-tgex-pink/70" />
          <div>
            <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-tgex-pink/80">
              TEC2 — Valorant Tournaments
            </p>
            <p className="text-xs text-tgex-light/55">
              Not in Price Center — separate venue. Neptune Valorant Tournament (Day 1) · High Tide Valorant Tournament (Day 2).
            </p>
          </div>
        </div>
      </div>

      {/* Instruction hint */}
      <p className="mt-3 text-center text-xs text-white/25">
        Click a floor in the 3D view or use the selector to explore each level
      </p>
    </div>
  );
}
