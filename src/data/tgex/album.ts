// Event album photos for TGEX 2026.
// To add photos:
//   1. Drop image files into public/album/
//   2. Add an entry to this array with the filename and optional caption/category.
//
// Supported categories: "general" | "tournaments" | "panels" | "cosplay" | "artist-alley" | "indie-games"

export type AlbumCategory =
  | "general"
  | "tournaments"
  | "panels"
  | "cosplay"
  | "artist-alley"
  | "indie-games";

export interface AlbumPhoto {
  src: string;           // path relative to /public, e.g. "/album/photo-001.jpg"
  alt: string;           // descriptive alt text
  caption?: string;      // optional caption shown on hover
  category: AlbumCategory;
  width?: number;        // original width in px (for Next.js Image optimisation)
  height?: number;       // original height in px
}

export const albumPhotos: AlbumPhoto[] = [
  // ── Add your photos here ──────────────────────────────────────────────
  // Example:
  // {
  //   src: "/album/opening-ceremony.jpg",
  //   alt: "Opening ceremony on the main stage",
  //   caption: "Opening ceremony — Day 1",
  //   category: "general",
  //   width: 1920,
  //   height: 1080,
  // },
];

export const albumCategories: { key: AlbumCategory | "all"; label: string }[] = [
  { key: "all",          label: "All Photos" },
  { key: "general",      label: "General" },
  { key: "tournaments",  label: "Tournaments" },
  { key: "panels",       label: "Panels & Guests" },
  { key: "cosplay",      label: "Cosplay" },
  { key: "artist-alley", label: "Artist Alley" },
  { key: "indie-games",  label: "Indie Games" },
];
