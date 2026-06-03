"use client";

import { useState, useMemo } from "react";

type Floor = 1 | 2 | 3 | 4;
type FloorFilter = Floor | "all";

const FLOOR_INFO: Record<Floor, { label: string; color: string; rooms: string[] }> = {
  1: {
    label: "Level 1",
    color: "tgex-teal",
    rooms: [
      "Sun God Lounge 205",
      "Bear Room 202",
      "Red Shoe Room 203",
      "Price Center Theater 101",
      "Central Plaza",
    ],
  },
  2: {
    label: "Level 2",
    color: "tgex-yellow",
    rooms: [
      "Green Table Room 206",
      "Dirty Birds 104",
      "Eleanor Roosevelt College Room 212",
      "Thurgood Marshall College Room 213",
      "Roger Revelle College Room 214",
      "John Muir College Room 221",
      "Ballroom West A 215",
      "Ballroom West B 216",
      "Dance Studio 219",
      "Ballroom East 220",
      "Check-In Counter",
    ],
  },
  3: {
    label: "Level 3",
    color: "tgex-blue",
    rooms: ["Warren College Room 302"],
  },
  4: {
    label: "Level 4",
    color: "tgex-indigo",
    rooms: ["The Forum 404"],
  },
};

const FLOOR_COLORS: Record<Floor, string> = {
  1: "#7BCDDD",
  2: "#E9D36A",
  3: "#5A9FC7",
  4: "#575B8A",
};

export default function PriceCenterMap() {
  const [filter, setFilter] = useState<FloorFilter>("all");

  const visibleFloors = useMemo(() => {
    if (filter === "all") return [1, 2, 3, 4] as Floor[];
    return [filter];
  }, [filter]);

  return (
    <div className="space-y-6">
      {/* Floor Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full border px-4 py-2 text-sm font-semibold tracking-wide transition ${"border-white/40 bg-white/12 text-white"}`}
        >
          All Floors
        </button>
        {[1, 2, 3, 4].map((f) => {
          const floor = f as Floor;
          const color = FLOOR_COLORS[floor];
          return (
            <button
              key={floor}
              onClick={() => setFilter(floor)}
              className="rounded-full border px-4 py-2 text-sm font-semibold tracking-wide transition"
              style={{
                borderColor: filter === floor ? color : "rgba(255,255,255,0.2)",
                background: filter === floor ? `${color}44` : "transparent",
                color: filter === floor ? "white" : "rgba(255,255,255,0.65)",
                boxShadow: filter === floor ? `0 0 16px ${color}88` : "none",
              }}
            >
              {FLOOR_INFO[floor].label}
            </button>
          );
        })}
      </div>

      {/* Floor Rooms Grid */}
      <div className="space-y-4">
        {visibleFloors.map((floor) => {
          const info = FLOOR_INFO[floor];
          const color = FLOOR_COLORS[floor];
          return (
            <div
              key={floor}
              className="rounded-2xl border p-6 backdrop-blur-sm"
              style={{
                borderColor: `${color}80`,
                backgroundColor: `${color}22`,
              }}
            >
              <h3
                className="mb-4 font-bungee text-xl uppercase tracking-wide"
                style={{ color }}
              >
                {info.label}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {info.rooms.map((room) => (
                  <div
                    key={room}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all hover:border-current hover:bg-white/5"
                    style={{
                      borderColor: `${color}66`,
                      color: `${color}`,
                    }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium">{room}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
