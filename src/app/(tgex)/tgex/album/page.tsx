"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { albumPhotos, albumCategories, type AlbumCategory } from "@/data/tgex/album";
import ZoomableImage from "@/components/tgex/zoomable-image";

export default function AlbumPage() {
  const [activeCategory, setActiveCategory] = useState<AlbumCategory | "all">("all");

  const filtered =
    activeCategory === "all"
      ? albumPhotos
      : albumPhotos.filter((p) => p.category === activeCategory);

  return (
    <div className="font-lexend mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="mb-10 text-center">
        <span className="inline-block rounded-full border border-tgex-yellow/50 bg-tgex-yellow/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">
          TGEX 2026
        </span>
        <h1 className="mt-3 font-bungee text-4xl uppercase text-white sm:text-5xl">
          Event Album
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-tgex-light/70">
          Photos from the 10th Annual Triton Gaming Expo — May 30–31, 2026 · UCSD Price Center
        </p>
        <Link
          href="/tgex"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bungee uppercase tracking-widest text-tgex-light/40 transition-colors hover:text-tgex-light/70"
        >
          ← Back to Home
        </Link>
      </div>

      {/* ─── Category filter ────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {albumCategories.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`rounded-full border px-5 py-2 font-bungee text-xs uppercase tracking-wider transition-all hover:scale-105 ${
              activeCategory === key
                ? "border-tgex-yellow bg-tgex-yellow/20 text-tgex-yellow shadow-[0_0_16px_rgba(247,202,102,0.35)]"
                : "border-white/15 bg-tgex-navy/40 text-tgex-light/50 hover:border-white/30 hover:text-tgex-light/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Photo grid ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-tgex-navy/30 px-8 py-24 text-center">
          <div className="mb-4 text-5xl">📸</div>
          <p className="font-bungee text-xl uppercase text-tgex-light/60">Photos Coming Soon</p>
          <p className="mt-2 max-w-sm text-sm text-tgex-light/40">
            Event photos will be posted here shortly. Check back soon!
          </p>
          <p className="mt-6 rounded-lg border border-white/10 bg-tgex-dark/50 px-4 py-3 text-left font-mono text-xs text-tgex-light/40">
            {/* Developer hint visible in the empty state */}
            Drop photos in <span className="text-tgex-teal">public/album/</span> and add entries
            to <span className="text-tgex-teal">src/data/album.ts</span>
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
          {filtered.map((photo, i) => (
            <div
              key={i}
              className="group mb-3 break-inside-avoid overflow-hidden rounded-xl border border-white/10 bg-tgex-navy/40 transition-all hover:-translate-y-0.5 hover:border-tgex-yellow/40 hover:shadow-[0_0_24px_rgba(247,202,102,0.2)]"
            >
              <ZoomableImage
                src={photo.src}
                alt={photo.alt}
                width={photo.width ?? 800}
                height={photo.height ?? 600}
                className="h-auto w-full object-cover"
              />
              {photo.caption && (
                <div className="px-3 py-2">
                  <p className="text-xs text-tgex-light/60">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Footer note ────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <p className="mt-10 text-center text-xs text-tgex-light/30">
          {filtered.length} photo{filtered.length !== 1 ? "s" : ""} · TGEX 2026 — The Multiverse
        </p>
      )}
    </div>
  );
}
