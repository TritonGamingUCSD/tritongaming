import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TGEX 2025 — Past Event",
  description: "TGEX 2025 was the ninth annual Triton Gaming Expo at UCSD Price Center.",
};

export default function Year2025() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16 text-center font-lexend sm:px-6">
      <span className="rounded-full border border-tgex-teal/50 bg-tgex-teal/15 px-4 py-2 font-bungee text-sm uppercase tracking-widest text-tgex-teal">
        Past Event
      </span>
      <h1 className="font-bungee text-5xl uppercase text-white sm:text-6xl">TGEX 2025</h1>
      <p className="max-w-lg text-lg text-tgex-light">
        Thank you to everyone who attended TGEX 2025. Full recap and VODs coming soon.
      </p>
      <Link
        href="/tgex"
        className="rounded-xl border border-tgex-yellow px-7 py-3.5 font-bungee text-base uppercase tracking-wider text-tgex-yellow transition-transform hover:scale-105"
      >
        TGEX 2026 →
      </Link>
    </div>
  );
}
