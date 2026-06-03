import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Check, Scroll } from "lucide-react";
import { Reveal } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

// ─── Theme lookup ─────────────────────────────────────────────────────────────

const T = {
  teal: {
    text: "text-tgex-teal",
    border: "border-tgex-teal",
    borderM: "border-tgex-teal/30",
    bg: "bg-tgex-teal/10",
    badge: "bg-tgex-teal/20 text-tgex-teal",
    glow: "rgba(71,169,155,0.25)",
  },
  magenta: {
    text: "text-tgex-magenta",
    border: "border-tgex-magenta",
    borderM: "border-tgex-magenta/30",
    bg: "bg-tgex-magenta/10",
    badge: "bg-tgex-magenta/20 text-tgex-magenta",
    glow: "rgba(255,29,111,0.25)",
  },
  indigo: {
    text: "text-tgex-light",
    border: "border-tgex-indigo",
    borderM: "border-tgex-indigo/30",
    bg: "bg-tgex-indigo/10",
    badge: "bg-tgex-indigo/20 text-tgex-light",
    glow: "rgba(67,59,178,0.25)",
  },
  orange: {
    text: "text-tgex-orange",
    border: "border-tgex-orange",
    borderM: "border-tgex-orange/30",
    bg: "bg-tgex-orange/10",
    badge: "bg-tgex-orange/20 text-tgex-orange",
    glow: "rgba(255,178,77,0.25)",
  },
} as const;

type ThemeKey = keyof typeof T;

interface UniverseData {
  name: string;
  emoji: string;
  themeKey: ThemeKey;
  questTitle: string;
  location: string;
  locationNote: string;
  storyParagraphs: string[];
}

// ─── Universe data ────────────────────────────────────────────────────────────

const UNIVERSES: Record<string, UniverseData> = {
  original: {
    name: "Original Universe",
    emoji: "🌐",
    themeKey: "teal",
    questTitle:
      "Follow the TG's Insta account to join the resistance! (or Discord!)",
    location: "Info Desk",
    locationNote:
      "Find a resistance officer at the Info Desk (Check-In Counter)",
    storyParagraphs: [
      `You and TEX just landed in the ORIGINAL UNIVERSE, the hub of the resistance against XET. After asking around, one of the most well-known pieces of the MAP to BYTE's location is guarded underground in the bunker of the resistance base known as "TRITON GAMING." However, due to XET's robot spies' constant attempts to infiltrate the ranks, security is at an all-time high. To get in, you're going to have to prove your loyalty to the cause. In this world, trust is the only currency that's got any kind of value.`,
      `Prove your trust by following TRITON GAMING's Instagram Account or joining TRITON GAMING's Discord Server and showing it to a resistance officer located at the info desk. Their scanners will ensure your loyalty and they will lead you to the piece of the MAP you're looking for.`,
    ],
  },
  graffiti: {
    name: "Graffiti Universe",
    emoji: "🎨",
    themeKey: "magenta",
    questTitle:
      "Paint over the influence! Make a piece of art and place it on the art wall located in the cozy game room to cover up the Overlord Xex propaganda!!!",
    location: "Art Wall — Cozy Game Room",
    locationNote: "Add your art to the art wall in the Cozy Game Room",
    storyParagraphs: [
      `The GRAFFITI UNIVERSE is not what you expected — a completely monochrome world plastered over with bland propaganda. Out of the corner of your eye, you see a group of street artists lurking out from the shadows, spray painting over the walls with colorful glam and glitter. As you and TEX run after them, a XET security bot spots you, but before it can catch you, a painter grabs you both by the collar and drags you away to their hideout. There, you learn that the piece of MAP towards Byte you're looking for is here, sealed away under all the black and white walls put up by the bots. XET couldn't destroy them because of the immense power hidden in art in this universe, so he just did the next best thing. And so now, it's up to you and the other graffiti artists to uncover the missing piece with as much color as you can muster.`,
      `Overlord XET is spreading propaganda across the universes to spread their influence. And the GRAFFITI UNIVERSE needs your help! Cover up XET's propaganda, and share some of your creativity while you're at it! Add your art to the art wall in Cozy Gameroom, and help brighten up the universe!`,
    ],
  },
  "star-guardian": {
    name: "Star Guardian",
    emoji: "✨",
    themeKey: "indigo",
    questTitle:
      "Become a star! Post, share, add to your story, or shout out TGEX on any social media platform and show this to the info desk!",
    location: "Info Desk",
    locationNote: "Show your post to the Info Desk (Check-In Counter)",
    storyParagraphs: [
      `The STAR GUARDIAN dimension used to be filled with stars of colorful light, filled with friendship and love. It was STAR GUARDIAN'S popularity that created a beacon that could hone this light into physical energy, protecting the universe from hate. As you and TEX descend into the dimension, the once sparkly sky has now been reduced to a fading bastion. XET's army is consuming the light of the world. The last resistance camp of STAR GUARDIANS asks you to inspire the people of the universe, like the STAR GUARDIANS did, and bring back the power of love. In exchange, they'll give you another piece of the map that leads towards BYTE.`,
      `The STAR GUARDIANS are battling XET in their universe as well, and need your help to defeat them! Support the Guardians by bringing some star power to the fight! Post, share, add to your story, or shout out TGEX on any social media platform and show this to the info desk!`,
    ],
  },
  flamehood: {
    name: "Flamehood",
    emoji: "🔥",
    themeKey: "orange",
    questTitle:
      "Show Overlord XET your fighting spirit! Check out the 6v6 tables in PC East and play a game.",
    location: "6v6 Tables — PC East",
    locationNote:
      "Play a game at the 6v6 tables in PC East (East Ballroom Floor)",
    storyParagraphs: [
      `In books of old, FLAMEHOOD was always known as the dimension with the strongest and greatest warriors, undefeated fighters whose names were echoed in song and story. Their mantra states that it is the bold and the brave who reign supreme. And as you and TEX search throughout FLAMEHOOD for the piece of map to BYTE, you find champions cleaving through hordes of XET's minions. But as you two try to join the cause, they stop you; only those who have proven themselves in battle can join this war and be trusted enough to be given the location of the map's final piece.`,
      `The FLAMEHOOD universe's resistance is built on passion and bravery, and they need your help! XET is trying to weaken the passion TGEX can bring; fight back by sharing some of your own! Play a game at one of the 6v6 tables in PC East to show what you're passionate about!`,
    ],
  },
};

// ─── Static params ────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(UNIVERSES).map((slug) => ({ universe: slug }));
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ universe: string }>;
}): Promise<Metadata> {
  const { universe: slug } = await params;
  const data = UNIVERSES[slug];
  if (!data) return { title: "Universe Not Found" };
  return {
    title: `${data.name} — Scavenger Hunt`,
    description: `${data.name} quest for the TGEX 2026 Scavenger Hunt. ${data.questTitle}`,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function UniversePage({
  params,
}: {
  params: Promise<{ universe: string }>;
}) {
  const { universe: slug } = await params;
  const data = UNIVERSES[slug];
  if (!data) notFound();

  const t = T[data.themeKey];

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-6 font-lexend sm:px-6 sm:py-10">
      {/* Back button */}
      <Reveal className="mb-6">
        <Link
          href="/tgex/scavenger-hunt"
          className="inline-flex items-center gap-2 text-sm text-tgex-light/50 transition hover:text-tgex-light"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scavenger Hunt
        </Link>
      </Reveal>

      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {data.emoji}
          </span>
          <div>
            <p
              className={`font-bungee text-xs uppercase tracking-[0.2em] ${t.text}`}
            >
              Scavenger Hunt — Universe
            </p>
            <h1 className={`font-bungee text-3xl uppercase sm:text-4xl ${t.text}`}>
              <LetterDrop text={data.name} />
            </h1>
          </div>
        </div>
      </Reveal>

      {/* Story */}
      <Reveal className="mb-8">
        <div
          className={`rounded-2xl border ${t.borderM} bg-tgex-navy/60 p-6 sm:p-8`}
          style={{ boxShadow: `0 0 60px ${t.glow}` }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Scroll className="h-4 w-4 text-tgex-yellow" aria-hidden />
            <span className="font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">
              Universe Story
            </span>
          </div>
          <div className="space-y-5">
            {data.storyParagraphs.map((p, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-tgex-light/80 sm:text-base"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Quest received */}
      <Reveal className="mb-6">
        <div className={`rounded-2xl border ${t.border} ${t.bg} p-6 sm:p-8`}>
          <div className="mb-3 flex items-center gap-2">
            <Check className={`h-5 w-5 ${t.text}`} aria-hidden />
            <span
              className={`font-bungee text-sm uppercase tracking-[0.2em] ${t.text}`}
            >
              Quest Received
            </span>
          </div>
          <p className="text-base font-semibold leading-relaxed text-white sm:text-lg">
            {data.questTitle}
          </p>
        </div>
      </Reveal>

      {/* Location */}
      <Reveal className="mb-8">
        <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <MapPin
            className="mt-0.5 h-6 w-6 shrink-0 text-tgex-yellow"
            aria-hidden
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-tgex-yellow">
              Quest Location
            </p>
            <p className="mt-1.5 font-semibold text-white">{data.location}</p>
            <p className="mt-1 text-sm text-tgex-light/60">{data.locationNote}</p>
            <Link
              href="/tgex/map"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-tgex-yellow underline-offset-2 hover:underline"
            >
              View on Map →
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Return CTA */}
      <Reveal>
        <Link
          href="/tgex/scavenger-hunt"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-tgex-yellow py-4 font-bungee text-sm uppercase tracking-wide text-tgex-dark transition hover:brightness-110"
        >
          Back to All Quests
        </Link>
      </Reveal>
    </div>
  );
}
