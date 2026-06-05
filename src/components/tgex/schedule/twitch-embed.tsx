"use client";

interface TwitchEmbedProps {
  channel: string;
}

/**
 * Renders a responsive Twitch channel embed.
 * The embed uses the current page's hostname as the `parent` parameter
 * so it works across localhost, preview, and production domains.
 */
export default function TwitchEmbed({ channel }: TwitchEmbedProps) {
  // Build the parent param from the current hostname at render time.
  const parent =
    typeof window !== "undefined" ? window.location.hostname : "localhost";

  const src = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&autoplay=false`;

  return (
    <section className="animate-enter rounded-2xl border border-[#9146FF]/40 bg-tgex-navy/50 p-5 shadow-[0_0_30px_rgba(145,70,255,0.2)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Twitch logo mark */}
          <svg viewBox="0 0 24 24" fill="#9146FF" className="h-6 w-6 shrink-0" aria-hidden>
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
          </svg>
          <div>
            <p className="font-bungee text-sm uppercase tracking-widest text-[#bf94ff]">
              Live Stream
            </p>
            <p className="text-xs text-tgex-light/70">
              Triton Gaming on Twitch &mdash; select tournament finals and stage events
            </p>
          </div>
        </div>
        <a
          href={`https://www.twitch.tv/${channel}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-[#9146FF]/60 bg-[#9146FF]/20 px-4 py-2 text-xs font-semibold text-[#bf94ff] transition-all hover:bg-[#9146FF]/30"
        >
          Open on Twitch
        </a>
      </div>

      {/* 16:9 responsive iframe wrapper */}
      <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={src}
          title={`${channel} Twitch stream`}
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </section>
  );
}
