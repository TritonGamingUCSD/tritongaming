import type { Metadata } from "next";
import Image from "next/image";
import { Reveal, RevealGroup, RevealItem } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Frequently asked questions for TGEX 2026 attendees at UCSD Price Center.",
};

const faqs = [
  {
    q: "When does the event start and end?",
    a: "TGEX 2026 runs Saturday, May 30 from 12 PM – 8 PM, and Sunday, May 31 from 12 PM – 8 PM.",
    icon: "🗓️",
  },
  {
    q: "What is required for entry?",
    a: "You'll need a valid form of ID (UC San Diego Student ID, valid driver's license, or valid passport card) and your unique Eventbrite QR code emailed to you after purchasing a ticket.",
    icon: "🎟️",
  },
  {
    q: "How can I get my badge early?",
    a: "UCSD students can attend Day 0 at the Loft on May 29, which includes badge decorating, free food, and exclusive chances to win Meet & Greet tickets with our panelists!",
    icon: "⭐",
  },
  {
    q: "Can I bring a bag?",
    a: "Yes — bags smaller than 10\"×10\" are allowed. Larger bags will not be permitted inside. We also recommend bringing a reusable water bottle and a portable charger. Plastic water bottles are not allowed, but there are water dispensers on site.",
    icon: "🎒",
  },
  {
    q: "What are prohibited items?",
    a: (
      <ul className="list-disc pl-4 space-y-1">
        <li>Alcohol</li>
        <li>Drugs &amp; Drug Paraphernalia</li>
        <li>Knives and Weapons</li>
        <li>Fireworks or Explosives</li>
        <li>Tobacco or Vapor Products</li>
        <li>Bags larger than 10&quot;&times;10&quot;</li>
        <li>Plastic water bottles (reusable water bottles are allowed)</li>
        <li>Skateboards or Roller Skates</li>
        <li>Professional &amp; Video Cameras</li>
        <li>Drones or Remote Control Aircraft/Toys/Cars</li>
      </ul>
    ),
    icon: "🚫",
  },
  {
    q: "Is cosplay allowed?",
    a: "Yes! No weapons or look-alikes — university policy strictly prohibits firearms or anything resembling a weapon on campus, even if fake or part of a costume. No costumes that mimic or stereotype cultures, religions, or groups of people. When in doubt, look it up or ask for feedback. Make sure everyone feels welcome!",
    icon: "🎭",
  },
  {
    q: "What props can I bring for a cosplay?",
    a: "Props must not resemble real weapons in any capacity. No prop swords, prop guns, or anything that could be mistaken for a real weapon. Lightweight, clearly decorative props (foam wings, oversized accessories, etc.) are generally fine. All props are subject to approval at the door.",
    icon: "🪄",
  },
  {
    q: "Where should I park?",
    a: "The closest lot is Gilman Parking Structure (252 Russell Ln, La Jolla, CA 92093). On weekends you can buy a NW Pass ($4.75/day) valid for S, B, and A spots, or use Visitor (V) parking at $2.25/hour (max $9/day). Pay at lot paystations or via the PayMobile app.",
    icon: "🅿️",
  },
  {
    q: "Where are the panel lines located?",
    a: "Panels are hosted at the Multipurpose Room (Student Services Center) or Price Center Theater. Lines form at the doors of the respective venue.",
    icon: "🎤",
  },
  {
    q: "Can minors attend?",
    a: "Minors must be accompanied by a guardian who is 21 years of age or older.",
    icon: "👨‍👧",
  },
  {
    q: "Where are the restrooms?",
    a: "Restrooms are on the 2nd floor across from West Ballroom and in the hallway between West and East Ballrooms. Additional restrooms are on the 1st, 3rd, and 4th floors of Price Center.",
    icon: "🚻",
  },
  {
    q: "What if I need to charge my device?",
    a: "We have a Rest & Recharge Room in the Warren Room at Price Center with available outlets — bring your own charging cables!",
    icon: "🔋",
  },
  {
    q: "Can I bring food and drinks?",
    a: "Outside food and drinks must be in sealed, spill-proof containers. There will also be food for purchase in Price Center and at our themed cafe in the Forum.",
    icon: "🍱",
  },
  {
    q: "I lost my badge or wristband. What do I do?",
    a: "Head to any check-in table and show your Eventbrite QR code again to request a replacement badge and wristband.",
    icon: "🪪",
  },
  {
    q: "I lost or found an item. What do I do?",
    a: "Bring found items to the Open Desk next to Library Walk just outside of Price Center to turn them in to lost and found. Check there first if you've lost something.",
    icon: "🔍",
  },
  {
    q: "Will tournaments be livestreamed?",
    a: "Select grand finals and stage events will be streamed on our Twitch. Follow Triton Gaming on social media for links and schedule updates.",
    icon: "📺",
  },
];

export default function FaqPage() {
  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-6 font-lexend sm:px-6 sm:py-8">

      {/* Floating sticker ornaments */}
      <div className="pointer-events-none absolute -right-4 top-8 w-20 opacity-60 sm:w-28" aria-hidden>
        <Image
          src="/stickers/sticker-badge.png"
          alt=""
          width={112}
          height={112}
          className="sticker h-auto w-full drop-shadow-lg"
          style={{ "--rot": "-12deg", "--delay": "0.2s" } as React.CSSProperties}
        />
      </div>
      <div className="pointer-events-none absolute -left-4 top-64 w-16 opacity-50 sm:w-24" aria-hidden>
        <Image
          src="/stickers/sticker-star.png"
          alt=""
          width={96}
          height={96}
          className="sticker h-auto w-full drop-shadow-lg"
          style={{ "--rot": "10deg", "--delay": "1s" } as React.CSSProperties}
        />
      </div>

      {/* Mascot peeking bottom-right */}
      <div className="pointer-events-none fixed bottom-[10rem] right-2 hidden w-24 opacity-70 md:block md:bottom-4 md:right-6 md:w-36" aria-hidden>
        <Image
          src="/mascots/byte.png"
          alt=""
          width={140}
          height={200}
          className="cosmic-float h-auto w-full drop-shadow-[0_0_16px_rgba(71,169,155,0.6)]"
          style={{ "--dur": "4s", "--delay": "0s" } as React.CSSProperties}
        />
      </div>

      {/* Xet lurking upper-left */}
      <div className="pointer-events-none absolute -left-8 top-10 w-28 opacity-[0.08] sm:w-44 sm:opacity-[0.07]" aria-hidden>
        <Image
          src="/mascots/xet.png"
          alt=""
          width={180}
          height={180}
          className="cosmic-float warp-flicker h-auto w-full"
          style={{ "--dur": "7s", "--delay": "1s", filter: "drop-shadow(0 0 20px #FF1D6F)" } as React.CSSProperties}
        />
      </div>

      <Reveal className="mb-10 flex flex-col items-center text-center">
        <span className="text-shimmer rounded-full border border-tgex-teal/50 bg-tgex-teal/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em]">
          Got Questions?
        </span>
        <h1 className="neon-underline mt-3 font-bungee text-4xl uppercase text-white sm:text-5xl">
          <LetterDrop text="FAQ" />
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-tgex-light/80">
          Quick answers for players, guests, and first-time attendees.
        </p>
      </Reveal>

      <RevealGroup className="space-y-3">
        {faqs.map((item) => (
          <RevealItem key={item.q}>
          <details
            className="holographic-card holo-card group rounded-xl border border-white/15 bg-tgex-navy/40 p-4 transition-all hover:border-tgex-magenta/50 hover:shadow-[0_0_24px_rgba(255,29,111,0.2)] open:border-tgex-magenta/65 open:shadow-[0_0_28px_rgba(255,29,111,0.25)]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 pr-2 text-base font-semibold text-white marker:content-none">
              <span className="shrink-0 text-xl" aria-hidden>{item.icon}</span>
              <span className="flex-1">{item.q}</span>
            </summary>
            <div className="mt-3 pl-7 text-sm leading-relaxed text-tgex-light/80">{item.a}</div>
          </details>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* Bottom callout */}
      <Reveal delay={0.1} className="mt-10 holo-card overflow-hidden rounded-2xl border border-tgex-indigo/60 bg-tgex-navy/50 p-6 text-center shadow-[0_0_30px_rgba(67,59,178,0.25)]">
        <p className="font-bungee text-2xl uppercase text-tgex-yellow">Still have questions?</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-tgex-light/70">Follow us on social media for the latest updates, or reach out anytime.</p>
        <div className="mt-6 flex items-center justify-center gap-4 flex-wrap px-4">
          {[
            {
              label: "Discord",
              href: "https://discord.gg/tritongaming",
              color: "hover:border-[#5865F2] hover:text-[#5865F2] hover:shadow-[0_0_12px_rgba(88,101,242,0.5)]",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              ),
            },
            {
              label: "Instagram",
              href: "https://www.instagram.com/tritongamingsd/",
              color: "hover:border-[#E1306C] hover:text-[#E1306C] hover:shadow-[0_0_12px_rgba(225,48,108,0.5)]",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              ),
            },
            {
              label: "X / Twitter",
              href: "https://x.com/tritongamingsd",
              color: "hover:border-white hover:text-white hover:shadow-[0_0_12px_rgba(255,255,255,0.3)]",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.766l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              ),
            },
            {
              label: "Twitch",
              href: "https://www.twitch.tv/tritongaming",
              color: "hover:border-[#9146FF] hover:text-[#9146FF] hover:shadow-[0_0_12px_rgba(145,70,255,0.5)]",
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
              ),
            },
          ].map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border border-tgex-light/30 text-tgex-light/70 transition-all ${social.color}`}
              title={social.label}
            >
              {social.icon}
            </a>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
