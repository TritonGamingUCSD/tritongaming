import venuesRaw from "@/data/tgex/venues.json";
import type { Venue } from "@/types/tgex-schedule";

const venues = venuesRaw as Venue[];

// Full class strings for Tailwind scanner
const C: Record<string, { border: string; heading: string; badge: string; dot: string }> = {
  teal:    { border: "border-tgex-teal/40",    heading: "text-tgex-teal",    badge: "bg-tgex-teal/15    text-tgex-teal",    dot: "bg-tgex-teal"    },
  magenta: { border: "border-tgex-magenta/40", heading: "text-tgex-magenta", badge: "bg-tgex-magenta/15 text-tgex-magenta", dot: "bg-tgex-magenta" },
  yellow:  { border: "border-tgex-yellow/40",  heading: "text-tgex-yellow",  badge: "bg-tgex-yellow/15  text-tgex-yellow",  dot: "bg-tgex-yellow"  },
  orange:  { border: "border-tgex-orange/40",  heading: "text-tgex-orange",  badge: "bg-tgex-orange/15  text-tgex-orange",  dot: "bg-tgex-orange"  },
  purple:  { border: "border-tgex-purple/40",  heading: "text-tgex-pink",    badge: "bg-tgex-purple/15  text-tgex-pink",    dot: "bg-tgex-purple"  },
  indigo:  { border: "border-tgex-indigo/40",  heading: "text-tgex-light",   badge: "bg-tgex-indigo/15  text-tgex-light",  dot: "bg-tgex-indigo"  },
  pink:    { border: "border-tgex-pink/40",    heading: "text-tgex-pink",    badge: "bg-tgex-pink/15    text-tgex-pink",    dot: "bg-tgex-pink"    },
};

export default function VenueMapView() {
  return (
    <div className="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {venues.map((venue) => {
        const c = C[venue.color] ?? C.indigo;
        return (
          <article
            key={venue.id}
            className={`holographic-card rounded-2xl border ${c.border} bg-tgex-dark/40 p-6 transition-all hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]`}
          >
            {/* Colored top accent bar */}
            <div className={`-mx-6 -mt-6 mb-5 h-1 w-[calc(100%+3rem)] rounded-t-2xl ${c.dot}`} aria-hidden />

            <div className="flex items-start justify-between gap-2">
              <h2 className={`font-bungee text-xl uppercase tracking-wide ${c.heading}`}>
                {venue.name}
              </h2>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${c.badge}`}>
                {venue.rooms.length > 0 ? `${venue.rooms.length} rooms` : "main"}
              </span>
            </div>

            {venue.rooms.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-1.5">
                {venue.rooms.map((room) => (
                  <li
                    key={room.id}
                    className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:brightness-125 ${c.badge}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot} shadow-[0_0_6px_currentColor]`} aria-hidden />
                    {room.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-tgex-light/60">Full floor space</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
