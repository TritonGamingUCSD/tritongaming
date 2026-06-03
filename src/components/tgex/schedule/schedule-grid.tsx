"use client";

import { Calendar, ChevronLeft, ChevronRight, Gamepad2, Gift, Handshake, Radio, Search, Star, Trophy, Users, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import venuesRaw from "@/data/tgex/venues.json";
import scheduleRaw from "@/data/tgex/schedule.json";
import type { Venue, ScheduleEvent } from "@/types/tgex-schedule";

// ── helper to get event link based on type ───────────────────────────────────
function getEventLink(event: ScheduleEvent): string | null {
  if (event.link) return event.link; // Use explicit link if provided
  // Route all schedule events through the schedule-event detail page
  return `/schedule-event/${event.id}`;
}

// ── constants ────────────────────────────────────────────────────────────────
const START_HOUR  = 12; // noon
const END_HOUR    = 20; // 8 PM
const SLOTS_PER_HOUR = 4; // quarter-hour slots
const SLOT_COUNT  = (END_HOUR - START_HOUR) * SLOTS_PER_HOUR; // 32 quarter-hour slots
const DESKTOP_TIME_COL_WIDTH_REM = 6;
const DESKTOP_VENUE_HEADER_HEIGHT_REM = 4;
const DESKTOP_ROOM_HEADER_HEIGHT_REM = 3.5;
const DESKTOP_SLOT_HEIGHT_REM = 3.25;

// ── type casts ───────────────────────────────────────────────────────────────
const venues = venuesRaw as Venue[];

// ── derived room list (computed once at module level) ────────────────────────
/**
 * Ordered flat list of "columns" in the schedule grid.
 * Venues with no sub-rooms appear as a single column using their own id.
 */
const allRooms = venues.flatMap((v) =>
  v.rooms.length
    ? v.rooms.map((r) => ({ id: r.id, name: r.name, venueId: v.id, color: v.color }))
    : [{ id: v.id, name: v.name, venueId: v.id, color: v.color }]
);

/**
 * Column start position (1-indexed, +1 offset for the time column)
 * and span count for each venue group header.
 */
const venueLayout = (() => {
  let col = 2; // column 1 is the time label
  return venues.map((v) => {
    const span  = v.rooms.length || 1;
    const start = col;
    col += span;
    return { venueId: v.id, start, span };
  });
})();

// ── color lookup ─────────────────────────────────────────────────────────────
// Full class strings so Tailwind's scanner can detect them at build time.
const C: Record<
  string,
  { header: string; text: string; roomHeader: string; eventBg: string; eventBorder: string }
> = {
  teal:    { header: "bg-tgex-teal/10",    text: "text-tgex-teal",    roomHeader: "bg-tgex-teal/5",    eventBg: "bg-tgex-teal/20",    eventBorder: "border-tgex-teal/50"    },
  magenta: { header: "bg-tgex-magenta/10", text: "text-tgex-magenta", roomHeader: "bg-tgex-magenta/5", eventBg: "bg-tgex-magenta/20", eventBorder: "border-tgex-magenta/50" },
  yellow:  { header: "bg-tgex-yellow/10",  text: "text-tgex-yellow",  roomHeader: "bg-tgex-yellow/5",  eventBg: "bg-tgex-yellow/20",  eventBorder: "border-tgex-yellow/50"  },
  orange:  { header: "bg-tgex-orange/10",  text: "text-tgex-orange",  roomHeader: "bg-tgex-orange/5",  eventBg: "bg-tgex-orange/20",  eventBorder: "border-tgex-orange/50"  },
  purple:  { header: "bg-tgex-purple/10",  text: "text-tgex-pink",    roomHeader: "bg-tgex-purple/5",  eventBg: "bg-tgex-purple/20",  eventBorder: "border-tgex-purple/50"  },
  indigo:  { header: "bg-tgex-indigo/10",  text: "text-tgex-light",   roomHeader: "bg-tgex-indigo/5",  eventBg: "bg-tgex-indigo/20",  eventBorder: "border-tgex-indigo/50"  },
  pink:    { header: "bg-tgex-pink/10",    text: "text-tgex-pink",    roomHeader: "bg-tgex-pink/5",    eventBg: "bg-tgex-pink/20",    eventBorder: "border-tgex-pink/50"    },
};

// ── helpers ──────────────────────────────────────────────────────────────────
/** Convert "HH:MM" to a 0-based quarter-hour slot index. */
function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - START_HOUR) * SLOTS_PER_HOUR + m / 15;
}

/** Format a slot index as a human-readable time string. */
function formatTime(slot: number): string {
  const totalMins = slot * 15 + START_HOUR * 60;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const suffix  = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatClock(time: string): string {
  const [hourRaw, minute] = time.split(":").map(Number);
  const suffix = hourRaw >= 12 ? "PM" : "AM";
  const hour = hourRaw % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatRange(start: string, end: string): string {
  return `${formatClock(start)} - ${formatClock(end)}`;
}

function getEventTypeIcon(type?: string) {
  switch (type) {
    case "Activity":
      return Gamepad2;
    case "Friendlies":
      return Users;
    case "Tournament":
      return Trophy;
    case "Panel":
      return Calendar;
    case "Social":
      return Handshake;
    case "Setup":
      return Wrench;
    case "Stream":
      return Radio;
    case "Opportunity Draw":
      return Gift;
    case "Meet & Greet":
      return Handshake;
    case "Performance":
      return Star;
    case "Event":
    default:
      return Calendar;
  }
}

// CSS grid row helpers (rows are 1-indexed):
//   row 1          → venue group header
//   row 2          → room name header
//   rows 3 – 18   → 16 time slots
//   row 19         → closing "8:00 PM" boundary label
const ROW_VENUE_HEADER = 1;
const ROW_ROOM_HEADER  = 2;
const ROW_FIRST_SLOT   = 3;

function slotToRow(slot: number) {
  return slot + ROW_FIRST_SLOT;
}

// ── Fancy desktop grid component with scroll-sync and frozen headers ────────
interface DesktopScheduleGridProps {
  gridStyle: React.CSSProperties;
  venueLayout: typeof venueLayout;
  allRooms: typeof allRooms;
  venues: Venue[];
  C: typeof C;
  ROW_VENUE_HEADER: number;
  ROW_ROOM_HEADER: number;
  SLOT_COUNT: number;
  slotToRow: (slot: number) => number;
  formatTime: (slot: number) => string;
  formatRange: (start: string, end: string) => string;
  filteredEvents: ScheduleEvent[];
}

function DesktopScheduleGrid(props: DesktopScheduleGridProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const scrollHorizontally = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) return;

    const delta = Math.max(node.clientWidth * 0.65, 320);
    node.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  };

  const scrollToVenueGroup = (venueId: string) => {
    const node = scrollRef.current;
    const gridNode = gridRef.current;
    if (!node || !gridNode) return;

    const venueMeta = props.venueLayout.find((entry) => entry.venueId === venueId);
    if (!venueMeta) return;

    const targetColumn = venueMeta.start;
    const venueHeader = gridNode.querySelector<HTMLElement>(`[data-venue-header="${venueId}"]`);

    if (venueHeader) {
      const targetLeft = venueHeader.offsetLeft - DESKTOP_TIME_COL_WIDTH_REM * 16;
      node.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
      return;
    }

    const approxColumnWidth = (gridNode.scrollWidth - DESKTOP_TIME_COL_WIDTH_REM * 16) / props.allRooms.length;
    const targetLeft = (targetColumn - 2) * approxColumnWidth;
    node.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  };

  return (
    <div className="relative hidden min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-tgex-dark/60 via-tgex-dark/50 to-tgex-dark/40 shadow-[0_0_60px_rgba(67,59,178,0.2),inset_0_0_40px_rgba(255,29,111,0.08)] lg:block">
      <div className="pointer-events-none absolute inset-y-0 left-[5.5rem] z-20 w-6 bg-gradient-to-r from-tgex-dark/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-tgex-dark/90 to-transparent" />

      <div className="absolute bottom-3 right-3 z-[80] flex items-center gap-2">
        <span className="rounded-full border border-white/10 bg-tgex-dark/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 backdrop-blur-md">
          Scroll Venues
        </span>
        <button
          type="button"
          onClick={() => scrollHorizontally("left")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-tgex-dark/85 text-white/80 backdrop-blur-md transition hover:border-tgex-teal/50 hover:text-tgex-teal"
          aria-label="Scroll schedule left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollHorizontally("right")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-tgex-dark/85 text-white/80 backdrop-blur-md transition hover:border-tgex-teal/50 hover:text-tgex-teal"
          aria-label="Scroll schedule right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-[80] hidden max-w-[calc(100%-11rem)] lg:block">
        <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-tgex-dark/80 px-3 py-1.5 backdrop-blur-md">
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Venue Colors
          </span>
          {props.venues.map((venue) => {
            const c = props.C[venue.color] ?? props.C.indigo;
            return (
              <button
                key={`legend-${venue.id}`}
                type="button"
                onClick={() => scrollToVenueGroup(venue.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition hover:brightness-110 ${c.eventBorder} ${c.eventBg} ${c.text}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full border ${c.eventBorder} ${c.header}`} />
                {venue.name}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="h-full overflow-auto overscroll-contain">
        <div ref={gridRef} className="min-w-max" style={props.gridStyle}>
          <div
            style={{ gridRow: props.ROW_VENUE_HEADER, gridColumn: 1, left: 0 }}
            className="sticky top-0 z-[70] border-b border-r border-white/10 bg-tgex-dark/95 backdrop-blur-xl"
          />

          {props.venueLayout.map(({ venueId, start, span }) => {
            const v = props.venues.find((x) => x.id === venueId)!;
            const c = props.C[v.color] ?? props.C.indigo;
            return (
              <div
                key={venueId}
                data-venue-header={venueId}
                style={{ gridRow: props.ROW_VENUE_HEADER, gridColumn: `${start} / span ${span}` }}
                className={`sticky top-0 z-50 flex h-full items-center justify-center border-b border-r border-white/10 px-4 backdrop-blur-xl ${c.header}`}
              >
                <span className={`px-1 text-center font-bungee text-sm uppercase tracking-widest ${c.text}`}>
                  {v.name}
                </span>
              </div>
            );
          })}

          <div
            style={{
              gridRow: props.ROW_ROOM_HEADER,
              gridColumn: 1,
              left: 0,
              top: `${DESKTOP_VENUE_HEADER_HEIGHT_REM}rem`,
            }}
            className="sticky z-[65] border-b border-r border-white/10 bg-tgex-dark/95 backdrop-blur-xl"
          />

          {props.allRooms.map((room, i) => {
            const c = props.C[room.color] ?? props.C.indigo;
            return (
              <div
                key={room.id}
                style={{
                  gridRow: props.ROW_ROOM_HEADER,
                  gridColumn: i + 2,
                  top: `${DESKTOP_VENUE_HEADER_HEIGHT_REM}rem`,
                }}
                className={`sticky z-40 flex h-full items-center justify-center border-b border-r border-white/10 px-3 backdrop-blur-xl ${c.roomHeader}`}
              >
                <span className="px-1 text-center text-xs font-semibold leading-snug text-white/85">
                  {room.name}
                </span>
              </div>
            );
          })}

          {Array.from({ length: props.SLOT_COUNT }, (_, slot) => {
            const isHour = slot % SLOTS_PER_HOUR === 0;
            const isHalf = slot % SLOTS_PER_HOUR === 2;

            return (
              <div
                key={`tlabel-${slot}`}
                style={{ gridRow: props.slotToRow(slot), gridColumn: 1, left: 0 }}
                className={`sticky z-30 flex items-start justify-end border-r border-white/10 px-2.5 pt-1.5 text-right ${
                  isHour ? "border-t border-white/20 bg-tgex-dark/92" : "border-t border-white/[0.04] bg-tgex-dark/88"
                }`}
              >
                {isHour ? (
                  <span className="whitespace-nowrap font-bungee text-xs font-bold leading-none text-tgex-magenta/85">
                    {props.formatTime(slot)}
                  </span>
                ) : isHalf ? (
                  <span className="whitespace-nowrap text-[10px] leading-none text-white/28">
                    {props.formatTime(slot)}
                  </span>
                ) : null}
              </div>
            );
          })}

          <div
            style={{ gridRow: props.slotToRow(props.SLOT_COUNT), gridColumn: 1, left: 0 }}
            className="sticky z-30 flex items-start justify-end border-r border-t border-white/20 bg-tgex-dark/92 px-2.5 pt-1.5 text-right"
          >
            <span className="whitespace-nowrap font-bungee text-xs font-bold leading-none text-tgex-magenta/85">
              {props.formatTime(props.SLOT_COUNT)}
            </span>
          </div>

          {Array.from({ length: props.SLOT_COUNT }, (_, slot) =>
            props.allRooms.map((_room, ri) => {
              const isHour = slot % SLOTS_PER_HOUR === 0;
              const isAltHour = Math.floor(slot / SLOTS_PER_HOUR) % 2 !== 0;
              return (
                <div
                  key={`bg-${slot}-${ri}`}
                  style={{ gridRow: props.slotToRow(slot), gridColumn: ri + 2 }}
                  className={[
                    "border-r border-white/5 transition-colors duration-200 hover:bg-white/[0.08]",
                    isHour ? "border-t border-white/15 bg-white/[0.025]" : "border-t border-white/[0.04]",
                    isAltHour ? "bg-white/[0.04]" : "",
                  ].join(" ")}
                />
              );
            })
          )}

          {props.filteredEvents.map((ev, idx) => {
            const roomIdx = props.allRooms.findIndex((r) => r.id === ev.roomId);
            if (roomIdx === -1) return null;
            const room = props.allRooms[roomIdx];
            const venueName = props.venues.find((v) => v.id === room.venueId)?.name ?? room.name;

            const startSlot = timeToSlot(ev.startTime);
            const endSlot = timeToSlot(ev.endTime);
            if (startSlot < 0 || endSlot > props.SLOT_COUNT || endSlot <= startSlot) return null;
            const slotSpan = endSlot - startSlot;

            const c = props.C[room.color] ?? props.C.indigo;
            const eventLink = getEventLink(ev);

            return (
              <div
                key={`${ev.id}-${ev.roomId}-${ev.startTime}-${idx}`}
                id={`event-${ev.id}`}
                style={{
                  gridColumn: roomIdx + 2,
                  gridRow: `${props.slotToRow(startSlot)} / ${props.slotToRow(endSlot)}`,
                  position: "relative",
                  zIndex: 10,
                }}
                className={`holo-card scroll-mt-32 group m-1.5 flex min-w-0 flex-col overflow-hidden rounded-xl border-2 transition-all duration-300 ${c.eventBorder} ${c.eventBg} ${
                  eventLink ? "cursor-pointer hover:shadow-[0_0_20px_rgba(67,59,178,0.4),inset_0_0_15px_rgba(67,59,178,0.1)]" : ""
                } hover:brightness-125`}
                onClick={eventLink ? () => router.push(eventLink) : undefined}
                role={eventLink ? "link" : undefined}
                tabIndex={eventLink ? 0 : undefined}
                onKeyDown={
                  eventLink
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(eventLink);
                        }
                      }
                    : undefined
                }
              >
                {/* Sticky header: title + time always visible regardless of event duration */}
                <div className={`sticky top-0 z-[5] flex-shrink-0 border-b border-white/10 bg-gradient-to-r from-tgex-dark/95 to-tgex-dark/70 px-2.5 py-2 backdrop-blur-md`}>
                  <p className={`text-[11px] font-bold leading-snug ${c.text}`}>{ev.title}</p>
                  <p className="mt-0.5 text-[10px] font-medium leading-tight text-white/65">
                    {props.formatRange(ev.startTime, ev.endTime)}
                  </p>
                </div>

                {/* Body: room label + description for longer events */}
                <div className="flex flex-1 flex-col overflow-hidden px-2.5 py-1.5">
                  {room.name !== venueName && slotSpan >= 3 && (
                    <p className="text-[10px] leading-tight text-white/50">{room.name}</p>
                  )}

                  {ev.description && slotSpan >= 8 && (
                    <p className="mt-1.5 line-clamp-3 pr-1 text-[10px] leading-relaxed text-white/45">
                      {ev.description}
                    </p>
                  )}

                  {(ev.link || ev.streamUrl) && slotSpan >= 4 && (
                    <div className="mt-auto pt-1.5 flex flex-wrap gap-1">
                      {ev.link && (
                        <a
                          href={ev.link}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all duration-200 ${c.eventBorder} ${c.text} hover:bg-white/10`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Details
                        </a>
                      )}
                      {ev.streamUrl && (
                        <a
                          href={ev.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block rounded-full border border-[#9146FF]/60 bg-[#9146FF]/15 px-2 py-0.5 text-[9px] font-semibold text-[#bf94ff] transition-all duration-200 hover:bg-[#9146FF]/25"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Watch
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── component ────────────────────────────────────────────────────────────────
export default function ScheduleGrid() {
  const [dayIdx, setDayIdx] = useState(0);
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const day    = scheduleRaw.days[dayIdx];
  const events = useMemo(() => (day?.events ?? []) as ScheduleEvent[], [day]);

  const roomMeta = useMemo(() => {
    return allRooms.reduce<Record<string, { name: string; venueId: string; color: string }>>(
      (acc, room) => {
        acc[room.id] = { name: room.name, venueId: room.venueId, color: room.color };
        return acc;
      },
      {}
    );
  }, []);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const byStart = timeToSlot(a.startTime) - timeToSlot(b.startTime);
      if (byStart !== 0) return byStart;
      return a.title.localeCompare(b.title);
    });
  }, [events]);

  // Get all unique event types
  const allEventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.type).filter((type): type is string => Boolean(type)));
    return Array.from(types).sort();
  }, [events]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    let result = sortedEvents;
    if (venueFilter !== "all") {
      result = result.filter((ev) => {
        const room = roomMeta[ev.roomId];
        return room?.venueId === venueFilter || ev.roomId === venueFilter;
      });
    }
    if (typeFilter !== "all") {
      result = result.filter((ev) => ev.type === typeFilter);
    }
    if (normalizedSearchQuery) {
      result = result.filter((ev) => {
        const room = roomMeta[ev.roomId];
        const venueName = room ? venues.find((v) => v.id === room.venueId)?.name ?? room.name : "";
        const haystack = [
          ev.title,
          ev.description,
          ev.type,
          room?.name,
          venueName,
          formatRange(ev.startTime, ev.endTime),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearchQuery);
      });
    }
    return result;
  }, [normalizedSearchQuery, roomMeta, sortedEvents, venueFilter, typeFilter]);

  const hasActiveFilters =
    venueFilter !== "all" || typeFilter !== "all" || normalizedSearchQuery.length > 0;

  const resetFilters = () => {
    setVenueFilter("all");
    setTypeFilter("all");
    setSearchQuery("");
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    // Column 1: fixed-width time label; remaining: equal-width room columns
    gridTemplateColumns: `${DESKTOP_TIME_COL_WIDTH_REM}rem repeat(${allRooms.length}, minmax(14rem, 1fr))`,

    // Rows: 2 header rows + slot rows + 1 closing label row
    gridTemplateRows: `${DESKTOP_VENUE_HEADER_HEIGHT_REM}rem ${DESKTOP_ROOM_HEADER_HEIGHT_REM}rem repeat(${SLOT_COUNT}, ${DESKTOP_SLOT_HEIGHT_REM}rem) ${DESKTOP_SLOT_HEIGHT_REM}rem`,
  };

  // If arriving with a hash like #event-d2-high-tide-valorant,
  // switch to the matching day and scroll to that event card.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash || "").replace("#", "");
    if (!hash.startsWith("event-")) return;

    const targetEventId = hash.replace("event-", "");
    const targetDayIdx = scheduleRaw.days.findIndex((d) =>
      d.events.some((ev) => ev.id === targetEventId)
    );

    if (targetDayIdx !== -1 && targetDayIdx !== dayIdx) {
      const frame = requestAnimationFrame(() => {
        setDayIdx(targetDayIdx);
        setVenueFilter("all");
      });

      return () => cancelAnimationFrame(frame);
    }

    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => cancelAnimationFrame(frame);
  }, [dayIdx]);

  return (
    <section className="font-lexend lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="mb-3 border-y border-white/10 bg-tgex-dark/70 px-4 py-3 backdrop-blur-lg sm:px-5 sm:py-3.5 lg:flex-shrink-0">
        {/* Day tabs */}
        <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-2">
          {scheduleRaw.days.map((d, i) => (
            <button
              key={d.date}
              onClick={() => {
                setDayIdx(i);
                resetFilters();
              }}
              className={`rounded-full px-4 py-2 text-center text-xs font-semibold tracking-wide transition-all sm:px-4 sm:py-1.5 ${
                i === dayIdx
                  ? "bg-tgex-magenta text-white shadow-[0_0_20px_rgba(255,29,111,0.5)]"
                  : "border border-white/20 text-tgex-light hover:border-tgex-magenta/50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, rooms, venues..."
              className="w-full rounded-full border border-white/15 bg-white/5 py-1.5 pl-9 pr-10 text-sm text-white placeholder:text-white/40 focus:border-tgex-teal/60 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tgex-light/70 lg:flex-shrink-0">
            <span>
              Showing <span className="font-semibold text-white">{filteredEvents.length}</span> of {events.length} events
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-0.5 font-semibold text-white transition hover:border-tgex-yellow/50 hover:text-tgex-yellow"
              >
                <X className="h-3.5 w-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Venue filters */}
        <div className="mb-2.5 flex flex-wrap gap-2 lg:justify-center">
          <button
            onClick={() => setVenueFilter("all")}
              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              venueFilter === "all"
                ? "border-tgex-teal/60 bg-tgex-teal/20 text-tgex-teal"
                : "border-white/20 text-tgex-light text-xs"
            }`}
          >
            All Venues
          </button>
          {venues.map((v) => {
            const c = C[v.color] ?? C.indigo;
            return (
              <button
                key={v.id}
                onClick={() => setVenueFilter(v.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  venueFilter === v.id
                    ? `${c.eventBorder} ${c.eventBg} ${c.text}`
                    : "border-white/20 text-tgex-light text-xs"
                }`}
              >
                {v.name}
              </button>
            );
          })}
        </div>

        {/* Event type filters */}
        {allEventTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 lg:justify-center">
            <button
              onClick={() => setTypeFilter("all")}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                typeFilter === "all"
                  ? "border-tgex-yellow/60 bg-tgex-yellow/20 text-tgex-yellow"
                  : "border-white/20 text-tgex-light text-xs"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              All Types
            </button>
            {allEventTypes.map((type) => {
              const Icon = getEventTypeIcon(type);
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    typeFilter === type
                      ? "border-tgex-pink/60 bg-tgex-pink/20 text-tgex-pink"
                      : "border-white/20 text-tgex-light text-xs hover:border-tgex-pink/40"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {type}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Mobile timeline view (grouped by start time) ─────────────────── */}
      <div className="space-y-5 lg:hidden">
        {(() => {
          // Group events by start time
          const groups = new Map<string, typeof filteredEvents>();
          for (const ev of filteredEvents) {
            const key = ev.startTime;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(ev);
          }
          const sortedKeys = [...groups.keys()].sort();

          return sortedKeys.map((time) => {
            const groupEvents = groups.get(time)!;
            return (
              <div key={time}>
                {/* Time header */}
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="font-bungee text-sm uppercase tracking-widest text-tgex-yellow">
                    {formatClock(time)}
                  </span>
                  <div className="h-px flex-1 bg-tgex-yellow/20" />
                </div>

                <div className="space-y-2">
                  {groupEvents.map((ev, idx) => {
                    const room = roomMeta[ev.roomId];
                    if (!room) return null;
                    const c = C[room.color] ?? C.indigo;
                    const venueName = venues.find((v) => v.id === room.venueId)?.name ?? room.name;
                    const eventLink = getEventLink(ev);

                    const cardContent = (
                      <article
                        className={`holographic-card holo-card rounded-xl border-l-4 ${c.eventBorder} border-y border-r border-white/10 bg-tgex-dark/50 px-3.5 py-3 transition-all hover:brightness-110 ${
                          eventLink ? "cursor-pointer" : ""
                        }`}
                      >
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h3 className="text-sm font-bold leading-snug text-white">{ev.title}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.eventBg} ${c.text}`}>
                            {ev.type ?? venueName}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tgex-light/70">
                          <span>{formatRange(ev.startTime, ev.endTime)}</span>
                          <span>•</span>
                          <span>{venueName}</span>
                          {room.name !== venueName && (
                            <>
                              <span>•</span>
                              <span>{room.name}</span>
                            </>
                          )}
                        </div>
                        {ev.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-tgex-light/70">{ev.description}</p>
                        )}
                        {(ev.link || ev.streamUrl) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {ev.link && (eventLink ? (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(ev.link, "_blank", "noreferrer"); }}
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${c.eventBorder} ${c.text} hover:brightness-125`}>
                                Details
                              </button>
                            ) : (
                              <a href={ev.link} target="_blank" rel="noreferrer"
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${c.eventBorder} ${c.text} hover:brightness-125`}>
                                Details
                              </a>
                            ))}
                            {ev.streamUrl && (eventLink ? (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(ev.streamUrl, "_blank", "noreferrer"); }}
                                className="inline-flex items-center gap-1 rounded-full border border-[#9146FF]/60 bg-[#9146FF]/15 px-3 py-1 text-xs font-semibold text-[#bf94ff] hover:brightness-125">
                                Watch Live
                              </button>
                            ) : (
                              <a href={ev.streamUrl} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-[#9146FF]/60 bg-[#9146FF]/15 px-3 py-1 text-xs font-semibold text-[#bf94ff] hover:brightness-125">
                                Watch Live
                              </a>
                            ))}
                          </div>
                        )}
                      </article>
                    );

                    return (
                      <div key={`${ev.id}-${ev.roomId}-${ev.startTime}-${idx}`} id={`event-${ev.id}`}>
                        {eventLink ? (
                          <Link href={eventLink} className="block">
                            {cardContent}
                          </Link>
                        ) : (
                          cardContent
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* ── Desktop schedule grid (fancy scroll-sync with frozen headers) ───── */}
      {/*
        Two-panel architecture: frozen left time column + scrollable right grid.
        The scrollable container uses overflow: auto (both axes) with sticky positioning:
        - Headers: sticky top-0 (freeze when scrolling down)
        - Time column: sticky left-0 (freeze when scrolling right)
        - Corner cell: sticky left-0 top-0 (freeze both directions)
        - Event titles: sticky within scrollable context
      */}
      <DesktopScheduleGrid
        gridStyle={gridStyle}
        venueLayout={venueLayout}
        allRooms={allRooms}
        venues={venues}
        C={C}
        ROW_VENUE_HEADER={ROW_VENUE_HEADER}
        ROW_ROOM_HEADER={ROW_ROOM_HEADER}
        SLOT_COUNT={SLOT_COUNT}
        slotToRow={slotToRow}
        formatTime={formatTime}
        formatRange={formatRange}
        filteredEvents={filteredEvents}
      />

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {filteredEvents.length === 0 && (
        <p className="mt-6 text-center text-sm text-tgex-muted">
          Schedule for {day?.label} coming soon — check back closer to the event!
        </p>
      )}
    </section>
  );
}
