"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  MapPin,
  X,
  Users,
  ChevronRight,
  ChevronDown,
  Check,
  Scroll,
  Trophy,
  Coffee,
  Tv,
  Mic,
} from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

// ─── Theme lookup (full class strings for Tailwind scanner) ──────────────────

const T = {
  teal: {
    text: "text-tgex-teal",
    border: "border-tgex-teal",
    borderM: "border-tgex-teal/30",
    bg: "bg-tgex-teal/10",
    badge: "bg-tgex-teal/20 text-tgex-teal",
    dot: "bg-tgex-teal",
    glow: "rgba(71,169,155,0.32)",
  },
  magenta: {
    text: "text-tgex-magenta",
    border: "border-tgex-magenta",
    borderM: "border-tgex-magenta/30",
    bg: "bg-tgex-magenta/10",
    badge: "bg-tgex-magenta/20 text-tgex-magenta",
    dot: "bg-tgex-magenta",
    glow: "rgba(255,29,111,0.32)",
  },
  indigo: {
    text: "text-tgex-light",
    border: "border-tgex-indigo",
    borderM: "border-tgex-indigo/30",
    bg: "bg-tgex-indigo/10",
    badge: "bg-tgex-indigo/20 text-tgex-light",
    dot: "bg-tgex-indigo",
    glow: "rgba(67,59,178,0.32)",
  },
  orange: {
    text: "text-tgex-orange",
    border: "border-tgex-orange",
    borderM: "border-tgex-orange/30",
    bg: "bg-tgex-orange/10",
    badge: "bg-tgex-orange/20 text-tgex-orange",
    dot: "bg-tgex-orange",
    glow: "rgba(255,178,77,0.32)",
  },
  pink: {
    text: "text-tgex-pink",
    border: "border-tgex-pink",
    borderM: "border-tgex-pink/30",
    bg: "bg-tgex-pink/10",
    badge: "bg-tgex-pink/20 text-tgex-pink",
    dot: "bg-tgex-pink",
    glow: "rgba(244,76,167,0.32)",
  },
  yellow: {
    text: "text-tgex-yellow",
    border: "border-tgex-yellow",
    borderM: "border-tgex-yellow/30",
    bg: "bg-tgex-yellow/10",
    badge: "bg-tgex-yellow/20 text-tgex-yellow",
    dot: "bg-tgex-yellow",
    glow: "rgba(247,202,102,0.32)",
  },
} as const;

type ThemeKey = keyof typeof T;

// ─── Data types ───────────────────────────────────────────────────────────────

interface Universe {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  themeKey: ThemeKey;
  questTitle: string;
  questOptions?: string[];
  location: string;
  locationNote: string;
  storyParagraphs: string[];
}

interface SideQuestData {
  id: string;
  title: string;
  emoji: string;
  description: string;
  location: string;
  themeKey: ThemeKey;
}

// ─── Universe data ────────────────────────────────────────────────────────────

const UNIVERSES: Universe[] = [
  {
    id: "original",
    slug: "original",
    name: "Original Universe",
    emoji: "\uD83C\uDF10",
    themeKey: "teal",
    questTitle:
      "Follow TG\u2019s Insta account (or Discord!) and find the resistance officer located at the INFO DESK.",
    location: "Info Desk \u2014 PC West",
    locationNote: "Find the resistance officer at the Info Desk \u2014 a separate table in PC West (NOT the Check-In Counter)",
    storyParagraphs: [
      "You and TEX just landed in the ORIGINAL UNIVERSE, the hub of the resistance against XET. After asking around, one of the most well-known pieces of the MAP to BYTE\u2019s location is guarded underground in the bunker of the resistance base known as \u201cTRITON GAMING.\u201d However, due to XET\u2019s robot spies\u2019 constant attempts to infiltrate the ranks, security is at an all-time high. To get in, you\u2019re going to have to prove your loyalty to the cause. In this world, trust is the only currency that\u2019s got any kind of value.",
      "Prove your trust by following TRITON GAMING\u2019s Instagram Account or joining TRITON GAMING\u2019s Discord Server and showing it to the resistance officer at the INFO DESK \u2014 a separate table in PC West (NOT the Check-In Counter). Their scanners will ensure your loyalty and they will lead you to the piece of the MAP you\u2019re looking for.",
    ],
  },
  {
    id: "flamehood",
    slug: "flamehood",
    name: "Flamehood",
    emoji: "\uD83D\uDD25",
    themeKey: "orange",
    questTitle:
      "Show Overlord XET your fighting spirit! Follow the flame arrows on the walls to any division showcase in East Ballroom and play a game.",
    location: "East Ballroom",
    locationNote: "Play a game at any division showcase in East Ballroom",
    storyParagraphs: [
      "In books of old, FLAMEHOOD was always known as the dimension with the strongest and greatest warriors, undefeated fighters whose names were echoed in song and story. Their mantra states that it is the bold and the brave who reign supreme. And as you and TEX search throughout FLAMEHOOD for the piece of map to BYTE, you find champions cleaving through hordes of XET\u2019s minions. But as you two try to join the cause, they stop you; only those who have proven themselves in battle can join this war and be trusted enough to be given the location of the map\u2019s final piece.",
      "The FLAMEHOOD universe\u2019s resistance is built on passion and bravery, and they need your help! XET is trying to weaken the passion TGEX can bring; fight back by sharing some of your own! Follow the flame arrows and play a game at any division showcase in East Ballroom to show what you\u2019re passionate about!",
    ],
  },
  {
    id: "star-guardian",
    slug: "star-guardian",
    name: "Star Guardian",
    emoji: "\u2728",
    themeKey: "indigo",
    questTitle:
      "Complete one of two quests and show it to the Info Desk!",
    questOptions: [
      "Become a star! Post, share, add to your story, or shout out TGEX on any social media platform and show it to the Info Desk.",
      "Compassion and support prevail! Buy a piece of art from any ART VENDOR at Triton Gaming and show it to the Info Desk!",
    ],
    location: "Info Desk \u2014 PC West",
    locationNote: "Show your completed quest to the Info Desk \u2014 a separate table in PC West (NOT the Check-In Counter)",
    storyParagraphs: [
      "The STAR GUARDIAN dimension used to be filled with stars of colorful light, filled with friendship and love. It was STAR GUARDIAN\u2019S popularity that created a beacon that could hone this light into physical energy, protecting the universe from hate. As you and TEX descend into the dimension, the once sparkly sky has now been reduced to a fading bastion. XET\u2019s army is consuming the light of the world. The last resistance camp of STAR GUARDIANS asks you to inspire the people of the universe, like the STAR GUARDIANS did, and bring back the power of love. In exchange, they\u2019ll give you another piece of the map that leads towards BYTE.",
      "The STAR GUARDIANS are battling XET in their universe as well, and need your help to defeat them! Support the Guardians by bringing some star power to the fight! Post, share, add to your story, or shout out TGEX on any social media platform and show this to the info desk! XET also loses power when you support others! Buy a piece of art from any of the art vendors in PC West to show your disapproval!",
    ],
  },
  {
    id: "graffiti",
    slug: "graffiti",
    name: "Graffiti Universe",
    emoji: "\uD83C\uDFA8",
    themeKey: "magenta",
    questTitle:
      "Paint over the influence! Make a piece of art and place it on the art wall located in the cozy game room to cover up the Overlord Xex propaganda!!!",
    location: "Art Wall \u2014 Cozy Game Room",
    locationNote: "Add your art to the art wall in the Cozy Game Room",
    storyParagraphs: [
      "The GRAFFITI UNIVERSE is not what you expected \u2014 a completely monochrome world plastered over with bland propaganda. Out of the corner of your eye, you see a group of street artists lurking out from the shadows, spray painting over the walls with colorful glam and glitter. As you and TEX run after them, a XET security bot spots you, but before it can catch you, a painter grabs you both by the collar and drags you away to their hideout. There, you learn that the piece of MAP towards Byte you\u2019re looking for is here, sealed away under all the black and white walls put up by the bots. XET couldn\u2019t destroy them because of the immense power hidden in art in this universe, so he just did the next best thing. And so now, it\u2019s up to you and the other graffiti artists to uncover the missing piece with as much color as you can muster.",
      "Overlord XET is spreading propaganda across the universes to spread their influence. And the GRAFFITI UNIVERSE needs your help! Cover up XET\u2019s propaganda, and share some of your creativity while you\u2019re at it! Add your art to the art wall in Cozy Gameroom, and help brighten up the universe!",
    ],
  },
];

const SIDE_QUESTS: SideQuestData[] = [
  {
    id: "cosplay-cafe",
    title: "Cosplay Cafe",
    emoji: "\u2615\uFE0F",
    description:
      "Take a break! Visit the cosplay cafe and be seated at a table by one of the hosts.",
    location: "Cosplay Cafe",
    themeKey: "pink",
  },
  {
    id: "indie-games",
    title: "Multipurpose Room(s)",
    emoji: "\uD83C\uDFAE",
    description:
      "Check out the industry and learn something new about what it takes to be involved with game development! Visit the indie game showcase in the MPR and get checked off — you\'ll receive BOTH halves of an opportunity drawing ticket. Turn in either half at the East Ballroom OR West Ballroom prize table.",
    location: "Multipurpose Room (MPR)",
    themeKey: "teal",
  },
  {
    id: "on-stage",
    title: "On Stage",
    emoji: "\uD83C\uDFA4",
    description:
      "Participate in an onstage event! The EMCEE will give you BOTH halves of an opportunity drawing ticket. Turn in either half at the East Ballroom OR West Ballroom prize table.",
    location: "Main Stage",
    themeKey: "yellow",
  },
];

// Story messages in original doc order: Encrypted \u2192 Incoming \u2192 Main Story
const STORY_MESSAGES = [
  {
    id: "encrypted",
    label: "Encrypted Message Decoded",
    source: "UNIVERSE 1738XV \u2014 Era 5",
    icon: "\uD83D\uDD10",
    paragraphs: [
      "Millions of planets gone. Billions consumed. A name that echoes a shudder among all who hear it. He is the end. OVERLORD XET.",
      "Before he captured my ship and crew, he was suddenly stopped by a little critter: BYTE. They say that battle warped the very existence of space and time. No one knew when or how their fight ended. All they knew was that both of them had disappeared, and peace returned to the multiverse.",
      "\u2014 Received Transcript From UNIVERSE 1738XV (message traced from Era 5)",
    ],
  },
  {
    id: "incoming",
    label: "Incoming Message",
    source: "UNIVERSE 92093X \u2014 (pronounced dead)",
    icon: "\uD83D\uDCE1",
    paragraphs: [
      "We should have known this peace wouldn\u2019t last forever. At first, we saw just a single star put out like a candle. And in the next instant, the entire sky had turned black. That\u2019s when we knew the devourer had returned.",
      "We lose more universes as the days go by. Every day, we wake up to see planets on our radar simply disappear. At this rate, he\u2019ll be upon us within the week. We don\u2019t have time to evacuate. Soon, we simply won\u2019t wake up, and another universe will see our dot on their radar disappear as well.",
      "I pray this message reaches you in time. XET is coming, and it feels like hope is lost. Run as far as you can and enjoy your moments for as long as you can have them. Cause eventually, all of reality will simply disappear.",
      "\u2014 Received Transcript from UNIVERSE 92093X (pronounced dead)",
    ],
  },
  {
    id: "main",
    label: "Main Story",
    source: "UNIVERSE X",
    icon: "\uD83D\uDCD6",
    paragraphs: [
      "On a small refugee colony on the outskirts of UNIVERSE X, a small group of survivors simply wait for the end. The smell of death lingers in the air. A heavy fog of apathy makes the air feel like molasses. What will come is simply inevitable.",
      "You and your childhood best friend, TEX, have grown up in this colony your entire lives, being transported when you were just babies. The older ones told you stories about the legendary hero known as Byte, who single-handedly stopped the great, evil XET. They whispered promises of the return of Byte, leading to the end of Overloard XET\u2019s rule. As the years went by, and their belief wore thin, prophecies such as these became stories of myth, and those myths became forgotten.",
      "While digging through the ruins of an abandoned research facility, you find the tattered instructions to find Byte. And it\u2019s at that moment, you remember the myths the elders used to tell you before bed. Perhaps there\u2019s still a chance to save the universe.",
      "As you both read the instructions, you realize that the MAP to find Byte is scattered throughout the multiverse, all located in universes already controlled by XET and his army. As risky as it may be, you look at the sky and watch the stars die in front of you, and you understand what has to be done. Now you must restore the MAP and find Byte before XET\u2019s corruption is completed.",
    ],
  },
];

// ─── Rebellion Counter ────────────────────────────────────────────────────────

function RebellionCounter() {
  const [count, setCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/rebellion", { cache: "no-store" });
      const data = await res.json();
      setCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-tgex-yellow/30 bg-tgex-yellow/8 px-4 py-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-tgex-yellow" aria-hidden />
        <span className="text-xs font-semibold text-tgex-yellow">
          Members who have joined the Rebellion!
        </span>
      </div>
      <span className="font-bungee text-xl text-white">
        {count === null ? (
          <span className="animate-pulse text-tgex-yellow/40">···</span>
        ) : (
          count.toLocaleString()
        )}
      </span>
    </div>
  );
}

// ─── Join form (compact, lives near the top) ──────────────────────────────────

function JoinFormCompact() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinedName, setJoinedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("tgex-rebellion-name");
    if (saved) {
      setJoined(true);
      setJoinedName(saved);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name to join!");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await fetch("/api/rebellion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      localStorage.setItem("tgex-rebellion-name", trimmed);
      setJoined(true);
      setJoinedName(trimmed);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (joined) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-tgex-teal/30 bg-tgex-teal/8 px-4 py-3">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tgex-teal/30">
          <Check className="h-3 w-3 text-tgex-teal" />
        </div>
        <div>
          <p className="text-sm font-semibold text-tgex-teal">
            {joinedName} is in the Rebellion!
          </p>
          <p className="mt-0.5 text-xs text-tgex-light/50">
            Thank you for finding me! Together, let&apos;s stop XET and save
            the MULTIVERSE!!!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-tgex-light/40">
        Put your name down to join the fight
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Your name&hellip;"
          maxLength={120}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-tgex-light/25 outline-none transition focus:border-tgex-yellow/50 focus:ring-1 focus:ring-tgex-yellow/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-tgex-yellow px-4 py-2.5 font-bungee text-xs uppercase tracking-wide text-tgex-dark transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "\u2026" : "Join \u2192"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-xs text-tgex-magenta">{error}</p>}
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-10">
      <div className="h-px flex-1 bg-white/[0.07]" />
      <span className="font-bungee text-[10px] uppercase tracking-[0.35em] text-white/20">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/[0.07]" />
    </div>
  );
}

// ─── Story accordion card ─────────────────────────────────────────────────────

function TransmissionCard({
  msg,
  defaultOpen = false,
}: {
  msg: (typeof STORY_MESSAGES)[number];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/[0.07] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 py-4 text-left"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-base leading-none" aria-hidden>
          {msg.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bungee text-xs uppercase tracking-wide text-tgex-yellow">
            {msg.label}
          </p>
          <p className="mt-0.5 text-[10px] text-tgex-light/35">
            Source: {msg.source}
          </p>
          {!open && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-tgex-light/45">
              {msg.paragraphs[0]}
            </p>
          )}
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-tgex-light/30 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-3 pb-5 pl-7">
          {msg.paragraphs.map((p, i) => (
            <p
              key={i}
              className={`text-sm leading-relaxed ${
                p.startsWith("\u2014")
                  ? "italic text-tgex-light/35"
                  : "text-tgex-light/75"
              }`}
            >
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inbox Card (groups Encrypted + Incoming messages) ────────────────────────

function InboxCard({
  messages,
}: {
  messages: (typeof STORY_MESSAGES);
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.07] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 py-4 text-left"
        aria-expanded={open}
      >
        <span className="mt-0.5 text-base leading-none" aria-hidden>
          📬
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bungee text-xs uppercase tracking-wide text-tgex-yellow">
            Inbox
          </p>
          <p className="mt-0.5 text-[10px] text-tgex-light/35">
            {messages.length} transmissions received
          </p>
          {!open && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-tgex-light/45">
              {messages[0].paragraphs[0]}
            </p>
          )}
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-tgex-light/30 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-6 pb-5 pl-7">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm leading-none" aria-hidden>
                  {msg.icon}
                </span>
                <p className="font-bungee text-xs uppercase tracking-wide text-tgex-yellow">
                  {msg.label}
                </p>
              </div>
              <p className="mb-2 text-[10px] text-tgex-light/35">
                Source: {msg.source}
              </p>
              <div className="space-y-3">
                {msg.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className={`text-sm leading-relaxed ${
                      p.startsWith("\u2014")
                        ? "italic text-tgex-light/35"
                        : "text-tgex-light/75"
                    }`}
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prizes ───────────────────────────────────────────────────────────────────

function PrizesSection() {
  const stickers = [
    { universe: "Original Universe", emoji: "\uD83C\uDF10", themeKey: "teal" as ThemeKey },
    { universe: "Flamehood", emoji: "\uD83D\uDD25", themeKey: "orange" as ThemeKey },
    { universe: "Star Guardian", emoji: "\u2728", themeKey: "indigo" as ThemeKey },
    { universe: "Graffiti Universe", emoji: "\uD83C\uDFA8", themeKey: "magenta" as ThemeKey },
  ];

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-tgex-light/40">
        Each universe station has its own unique sticker design
      </p>
      <p className="mb-4 text-sm text-tgex-light/60">
        Complete a universe quest and collect that universe&apos;s exclusive sticker — 4 unique designs to find.{" "}
        <span className="font-semibold text-tgex-orange">While supplies last!</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {stickers.map(({ universe, emoji, themeKey }) => {
          const t = T[themeKey];
          return (
            <div key={universe} className={`rounded-2xl border ${t.borderM} ${t.bg} p-4`}>
              <span className="mb-2 block text-2xl" aria-hidden>{emoji}</span>
              <p className={`font-bungee text-[10px] uppercase tracking-wider ${t.text}`}>
                {universe}
              </p>
              <p className="mt-2 text-xs text-tgex-light/70">&#11088; Unique sticker design</p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-2xl border border-tgex-yellow/30 bg-tgex-yellow/8 p-4">
        <p className="mb-1 font-bungee text-[10px] uppercase tracking-wider text-tgex-yellow">Opportunity Drawing Tickets</p>
        <p className="text-xs text-tgex-light/70">
          Visit the <span className="font-semibold text-white">On Stage</span> or <span className="font-semibold text-white">Multipurpose Room (MPR)</span> side quests to receive both halves of an opportunity drawing ticket. Turn in either half at the <span className="font-semibold text-white">East Ballroom</span> OR <span className="font-semibold text-white">West Ballroom</span> prize table.
        </p>
      </div>
    </div>
  );
}

// ─── How To Play ──────────────────────────────────────────────────────────────

function HowToPlay() {
  const steps = [
    {
      num: "1",
      title: "Explore the Universes",
      desc: "Visit each of the 4 universe quest stations around the expo.",
    },
    {
      num: "2",
      title: "Collect All 4 Stickers",
      desc: "Complete each universe quest to receive that universe's unique sticker design. While supplies last!",
    },
    {
      num: "3",
      title: "Bonus: Opportunity Drawing",
      desc: "Visit the On Stage or MPR side quests to receive both halves of an opportunity drawing ticket. Turn in at East OR West Ballroom.",
    },
  ];

  return (
    <div className="space-y-5">
      {steps.map((step) => (
        <div key={step.num} className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-bungee text-sm text-white/50">
            {step.num}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-tgex-light/55">
              {step.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Universe Modal (portal \u2014 bottom sheet on mobile) ──────────────────────────

function UniverseModal({
  universe,
  onClose,
}: {
  universe: Universe;
  onClose: () => void;
}) {
  const t = T[universe.themeKey];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-label={`${universe.name} quest details`}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        className={`relative z-10 w-full max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-x ${t.borderM} bg-tgex-dark/98 sm:max-w-2xl sm:rounded-3xl sm:border`}
        style={{
          boxShadow: `0 -8px 60px ${t.glow}, 0 0 0 1px rgba(255,255,255,0.04)`,
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Sticky header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between gap-3 border-b ${t.borderM} bg-tgex-dark/95 px-5 py-4 backdrop-blur-md sm:px-8`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {universe.emoji}
            </span>
            <h2 className={`font-bungee text-lg uppercase sm:text-xl ${t.text}`}>
              {universe.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-tgex-light/70 transition hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="mb-2 flex items-center gap-2">
            <Scroll className="h-4 w-4 text-tgex-yellow" aria-hidden />
            <span className="font-bungee text-xs uppercase tracking-[0.2em] text-tgex-yellow">
              Universe Story
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {universe.storyParagraphs.map((p, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-tgex-light/80"
              >
                {p}
              </p>
            ))}
          </div>

          {/* Quest received */}
          <div className={`mt-8 rounded-xl border ${t.borderM} ${t.bg} p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <Check className={`h-4 w-4 ${t.text}`} aria-hidden />
              <span
                className={`font-bungee text-xs uppercase tracking-[0.2em] ${t.text}`}
              >
                Quest Received
              </span>
            </div>
            {universe.questOptions ? (
              <div className="space-y-1">
                {universe.questOptions.map((opt, i) => (
                  <div key={i}>
                    {i > 0 && (
                      <div className="my-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="font-bungee text-xl text-tgex-yellow">OR</span>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                    )}
                    <p className="text-sm font-semibold leading-relaxed text-white">{opt}</p>
                  </div>
                ))}
                <p className="mt-4 rounded-lg bg-tgex-orange/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-tgex-orange">
                  ⚠️ You only have to complete ONE! Completing both will not give you bonus checks!
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold leading-relaxed text-white">
                {universe.questTitle}
              </p>
            )}
          </div>

          {/* Location */}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <MapPin
              className="mt-0.5 h-5 w-5 shrink-0 text-tgex-yellow"
              aria-hidden
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-tgex-yellow">
                Location
              </p>
              <p className="mt-1 text-sm text-tgex-light/75">
                {universe.locationNote}
              </p>
            </div>
          </div>

          {/* Subpage link */}
          <Link
            href={`/scavenger-hunt/${universe.slug}`}
            className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl border ${t.border} ${t.bg} py-3 font-bungee text-sm uppercase tracking-wider ${t.text} transition hover:brightness-110`}
          >
            View Full Universe Page
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

// ─── Universe Card ────────────────────────────────────────────────────────────

function UniverseCard({
  universe,
  onOpen,
}: {
  universe: Universe;
  onOpen: () => void;
}) {
  const t = T[universe.themeKey];

  return (
    <button
      onClick={onOpen}
      className={`group flex w-full items-start gap-4 rounded-2xl border ${t.borderM} bg-tgex-navy/30 p-4 text-left transition-all active:scale-[0.98] hover:bg-tgex-navy/50`}
      aria-label={`Open ${universe.name} quest`}
    >
      <span className="mt-0.5 text-3xl leading-none" aria-hidden>
        {universe.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-bungee text-sm uppercase ${t.text}`}>
          {universe.name}
        </p>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-tgex-light/60">
          {universe.questTitle}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <MapPin className="h-3 w-3 shrink-0 text-tgex-yellow" aria-hidden />
          <span className="text-xs text-tgex-light/40">{universe.location}</span>
        </div>
      </div>
      <ChevronRight
        className={`mt-1 h-4 w-4 shrink-0 opacity-40 transition-opacity group-hover:opacity-70 ${t.text}`}
        aria-hidden
      />
    </button>
  );
}

// ─── Side Quest Row ───────────────────────────────────────────────────────────

const SIDE_ICONS = {
  "cosplay-cafe": Coffee,
  "indie-games": Tv,
  "on-stage": Mic,
} as const;

function SideQuestRow({ quest }: { quest: SideQuestData }) {
  const [open, setOpen] = useState(false);
  const t = T[quest.themeKey];
  const Icon = SIDE_ICONS[quest.id as keyof typeof SIDE_ICONS] ?? Trophy;

  return (
    <div className="border-b border-white/[0.07] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.bg}`}
        >
          <Icon className={`h-4 w-4 ${t.text}`} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white">{quest.title}</p>
          </div>
          {!open && (
            <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-tgex-light/60">
              {quest.description}
            </p>
          )}
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-tgex-light/30 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="pb-4 pl-[52px]">
          <p className="text-sm leading-relaxed text-tgex-light/75">
            {quest.description}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-tgex-yellow" aria-hidden />
            <span className="text-xs text-tgex-light/40">{quest.location}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ending Message ───────────────────────────────────────────────────────────

function EndingMessage() {
  return (
    <div className="rounded-2xl border border-tgex-yellow/30 bg-tgex-yellow/5 px-5 py-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg" aria-hidden>&#x1F4D6;</span>
        <p className="font-bungee text-sm uppercase tracking-wide text-tgex-yellow">
          The Multiverse is Saved
        </p>
      </div>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-tgex-light/80">
          Alas, with all pieces of the map complete, a beacon of light illuminates the path where BYTE is sealed away. But it seems like there is no need to go looking for him. In a brief moment, BYTE crashes down onto the beacon. As it turns out, each piece of the MAP was enchanted with celestial magic that would break the seal OVERLORD XET had on BYTE. BYTE&apos;s eyes are filled with hope for the new future of all universes without OVERLORD XET&apos;s influence. He opens a wormhole that would take you to OVERLORD XET&apos;s location and put an end to his rule. After he steps in, he sticks his hand towards you. Are you going to join BYTE?
        </p>
        <p className="font-bungee text-sm uppercase tracking-wide text-tgex-yellow">
          Thanks for attending TGEX! Please enjoy both DAY ONE and DAY TWO of TG!
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScavengerHuntClient() {
  const [openUniverse, setOpenUniverse] = useState<Universe | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-lg px-4 py-6 font-lexend sm:px-6 sm:py-10">

      {/* -- Counter -------------------------------------------------- */}
      <Reveal>
        <RebellionCounter />
      </Reveal>

      {/* -- Title ---------------------------------------------------- */}
      <Reveal className="mb-5 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-yellow/40 bg-tgex-yellow/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em]">
          TGEX 2026 Interactive
        </span>
        <h1 className="mt-3 font-bungee text-4xl uppercase text-white">
          <LetterDrop text="Scavenger Hunt" />
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-tgex-light/60">
          Free the universe from Overlord XET&apos;s rule! Complete quests
          across four universes to restore balance to the multiverse.
        </p>
      </Reveal>

      {/* -- Join form ------------------------------------------------ */}
      <Reveal className="mb-2">
        <JoinFormCompact />
      </Reveal>

      {/* == How to Play ============================================ */}
      <SectionRule label="How to Play" />

      <Reveal>
        <HowToPlay />
      </Reveal>

      {/* == The Story ============================================== */}
      <SectionRule label="The Story" />

      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-tgex-navy/30 px-4">
          <TransmissionCard
            msg={STORY_MESSAGES.find((m) => m.id === "main")!}
            defaultOpen={true}
          />
          <InboxCard
            messages={STORY_MESSAGES.filter((m) => m.id !== "main")}
          />
        </div>
      </Reveal>

      {/* == Prizes ================================================= */}
      <SectionRule label="Prizes" />

      <Reveal>
        <PrizesSection />
      </Reveal>

      {/* == Universe Quests ============================================ */}
      <SectionRule label="Universe Quests" />

      <Reveal className="mb-4">
        <p className="text-base font-semibold text-tgex-light/70">
          Complete each universe quest to collect its exclusive sticker. Tap a universe to read its
          full story and get the quest details.
        </p>
      </Reveal>

      <RevealGroup className="space-y-3">
        {UNIVERSES.map((universe) => (
          <RevealItem key={universe.id}>
            <UniverseCard
              universe={universe}
              onOpen={() => setOpenUniverse(universe)}
            />
          </RevealItem>
        ))}
      </RevealGroup>

      {/* == Side Quests ============================================ */}
      <SectionRule label="Side Quests" />

      <Reveal className="mb-4">
        <p className="text-sm leading-relaxed text-tgex-light/60">
          Saving the universe can be quite overwhelming and tiring\u2026 Though
          the multiverse may be in peril, it is important to explore and
          remember what we are saving. Check out these additional locations
          spread throughout the convention!
        </p>
      </Reveal>

      <Reveal>
        <div className="rounded-2xl border border-white/[0.08] bg-tgex-navy/30 px-4">
          {SIDE_QUESTS.map((quest) => (
            <SideQuestRow key={quest.id} quest={quest} />
          ))}
        </div>
      </Reveal>

      {/* -- Ending Message ------------------------------------------- */}
      <Reveal className="mt-6">
        <EndingMessage />
      </Reveal>

      {/* -- Bottom breathing room --------------------------------- */}
      <div className="h-16" />

      {/* -- Modal ------------------------------------------------ */}
      {mounted && openUniverse && (
        <UniverseModal
          universe={openUniverse}
          onClose={() => setOpenUniverse(null)}
        />
      )}
    </div>
  );
}
