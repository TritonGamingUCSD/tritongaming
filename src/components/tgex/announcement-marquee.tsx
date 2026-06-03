"use client";

import { usePathname } from "next/navigation";

export default function AnnouncementMarquee() {
  const pathname = usePathname();
  const showMarquee = pathname !== "/tgex/sponsors";

  if (!showMarquee) {
    return null;
  }

  return (
    <div
      className="energy-surge relative z-40 overflow-hidden border-b border-tgex-magenta/50 bg-tgex-dark/95 py-1.5 backdrop-blur-sm"
      style={{ "--sur-dur": "5s", "--sur-delay": "0s" } as React.CSSProperties}
    >
      <div className="marquee-track">
        {[...Array(2)].map((_, pass) => (
          <span key={pass} className="flex items-center gap-0">
            {[
              { icon: "🎉", text: "THANK YOU FOR ATTENDING TGEX 2026!" },
              { icon: "📸", text: "EVENT ALBUM NOW AVAILABLE — RELIVE THE MEMORIES" },
              { icon: "🏆", text: "10TH ANNIVERSARY — THE MULTIVERSE — MAY 30–31, 2026" },
              { icon: "💜", text: "SEE YOU AT TGEX 2027!" },
              { icon: "🌌", text: "ENTER THE MULTIVERSE — TGEX 2026 RECAP" },
              { icon: "🎮", text: "TOURNAMENTS · PANELS · ARTIST ALLEY · INDIE GAMES" },
              { icon: "✨", text: "THANK YOU TO OUR SPONSORS, GUESTS & COMMUNITY" },
              { icon: "🔮", text: "THE RIFT HAS CLOSED — UNTIL NEXT YEAR" },
            ].map((item) => (
              <span
                key={item.text}
                className="shrink-0 px-8 font-bungee text-xs uppercase tracking-widest"
              >
                <span className="text-tgex-yellow">{item.icon}</span>
                <span className="text-tgex-light/85"> {item.text}</span>
                <span className="mx-8 text-tgex-magenta/70">◆</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

