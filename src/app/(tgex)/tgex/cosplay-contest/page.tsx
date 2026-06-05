import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/tgex/reveal";
import { LetterDrop } from "@/components/tgex/letter-drop";

export const metadata: Metadata = {
  title: "Cosplay Contest",
  description: "Contest details and rules for the TGEX 2026 Cosplay Contest.",
};

export default function CosplayPage() {
  const contestRules = [
    "Cosplay must be G, PG, or PG-13 since this is a public event. No nudity or profanity is allowed on the stage.",
    "Participants will provide the organizers with their name (cosplay alias or real name), the name of the cosplay, the media the cosplay is from, and a short introduction.",
    "Participants must arrive 30 minutes (1:30pm) prior to the start of the event.",
    "There will be no obscene acts during the catwalk.",
    "Cosplay must be self-contained and self-sufficient. We cannot provide connections to electrical sockets.",
    "You will have up to 3 minutes of stage time to show off your cosplay. You do not have to use the whole time.",
    "Shoes must be worn at all times. Bare feet are not allowed. If a character does not wear shoes, consider using flip-flops/sandals with clear straps or making a form of invisible shoes where there is a barrier between foot soles and ground.",
    "All weapons and props must be con-safe (see Con-Safe Prop guidelines below).",
    "Any costumes that have placed and/or won in previous years' TG Cosplay Contests (e.g., TGEX 2025, The Traveler's Dream, etc.) cannot be resubmitted or re-entered for TGEX 2026 unless significant changes have been made in between competitions.",
  ];

  const generalPropRules = [
    "Oversized props that pose a mobility hazard through doors, stairways, or elevators are prohibited. Recommended dimensions less than six feet in any direction; items in excess will be judged on a case-by-case basis.",
    "Overweight props that pose a danger to persons or property, if dropped, are prohibited. Recommended weight is less than 30lb.",
    "Any prop, outfit, or armor piece must not be made of a material that can injure a passerby via a sharp edge, point, spike or stud. If those shapes are required, use cloth or foam, not metal or hardened/reinforced plastics.",
    "No explosives or chemicals including, but not limited to, fireworks, smoke pots, flash paper, etc.",
    "Objects that can generate excessive noise, light, smoke, or confetti are prohibited on event grounds.",
    "Props cannot be thrown, tossed, shot, or swung regardless of its construction and functionality. They must be under the holder's control at all times. No exceptions will be made for boffer/LARP weaponry or sparring equipment.",
    "Sports equipment is allowed so long as they are not used to strike items (balls, pucks, etc.) and held under control at all times. They are subject to all the size, weight, and material restrictions listed above.",
    "Props must be secured to a costume or held in a manner in such that they do not endanger others. Be aware that the event may become crowded and take appropriate precautions.",
  ];

  const propWeaponryRules = [
    "No actual functioning weaponry regardless if it is sheathed, holstered, or peacebound. This includes (but is not limited to): firearms, knives, bludgeons, stun guns, brass knuckles, bows strung with tense string/capable of firing, bullets, grenades, landmines, etc.",
    "No Live Steel, AKA any metal that holds a bladed edge (regardless if sharpened or not, or is shaped in a way that has sharp edges or spikes). Any actual metal used in a piece must be rounded and curved and not be the edge portion of a prop blade. Examples of prohibited items in this category include real metal swords or axes with blunted blades.",
    "You may not point at a person or brandish any prop weapon in a threatening manner outside of posed photos.",
    "Realistic-looking guns, firearms, grenades, etc. props must be peacebound (taped or ziptied) by a staff member and checked for safety.",
    "Chains and ropes are limited to 3 ft in length if they are uncoiled or used to attach to prop weapons (i.e. kusarigama, morningstars, etc.). They cannot hang in such a manner as to pose an entanglement or trip hazard. They cannot be swung and must be under control at all times. Ropes/chains that are completely integrated into clothing or coiled into bundles (not hanging loosely) are not limited to 3 feet.",
    "Chains cannot be of heavyweight metal gauges (lightweight plastic linked chains are allowed and preferred).",
    "Bows and crossbows can be strung but they must not have enough tension to fire an arrow or object with any appreciable speed. Bows should ideally not be capable of firing projectiles.",
  ];

  const firearmRules = [
    "No projectile-firing weapons with ammo are allowed (e.g., real strung bow and arrow, real gun, real shurikens, etc.).",
    "No full metal firearm replicas are allowed.",
    "No functional projectile weapons/toys that are modified into props are allowed (e.g., Airsoft guns, water guns, bubble shooters, spark guns, BB guns, crossbows, nerf guns, etc.). For disabled projectile weapons/toys, see below.",
    "Disabled projectile weapons/toys that have been modified into props and are completely incapable of firing a projectile are only allowed if they adhere to additional guidelines outlined below.",
    "Prop bullets and prop shells are allowed in bandoleers or holders, but they CANNOT be inserted into weapons or loaded into magazines under any circumstances.",
    "No shell casings of any kind will be allowed.",
    "For props with realistic silhouettes (those resembling actual civilian and military firearms, e.g., AK-47, M-16, Glock 17, etc.):",
    "Must have one side be fixed with bright colored tape.",
    "A Safety/Blaze orange tip is required; it must be noticeable from a distance. It can be painted on, electrical taped on, or be a removable sheath. The tip must remain in place while at the convention.",
    "The barrel must be plugged. This can be done permanently such as using an epoxy resin, or it can be done in a removable method such as a foam insert — the method does not matter. The barrel must remain plugged while at the convention.",
    "Triggers must be peacebound by event staff. This will be done with zip-ties, electrical tape, etc.",
    "If no trigger exists, the tie or band will be secured through the trigger guard or around the handgrip.",
    "Pistols with removable magazines cannot have them inserted.",
    "For non-realistic silhouettes (do not resemble any actual civilian and military firearms, e.g., space blasters, phasers, zat guns, video game light guns, etc.):",
    "Triggers must be peacebound by convention staff. This will be done with zip-ties, electrical tape, etc.",
    "If no trigger exists, the tie or band will be secured through the trigger guard or around the handgrip.",
  ];

  const contestOverview = [
    "Participants will be called to the stage by emcees and introduced to the audience.",
    "Participants are given 1-3 (max) minutes to showcase their cosplay and give a brief performance (e.g., pose, dance, etc.).",
    "After the showcase, judges may ask participants questions about their cosplay to formulate scoring decisions (e.g., construction/process in making cosplay, etc.).",
    "Judges score each cosplayer individually in 4 categories on a scale of 1-5.",
    "After each cosplayer has been called, scores will be tallied and the top 3 cosplayers will be determined.",
    "The top 3 finalists will be called up again to give any final comments, allow judges a closer look at cosplays and ask last questions.",
    "Judges will deliberate and decide on the final winner lineup (1st place, 2nd place, 3rd place).",
  ];

  return (
    <div className="relative mx-auto w-full max-w-[120rem] px-4 py-8 font-lexend sm:px-6 sm:py-12">
      {/* Header */}
      <Reveal className="mb-12 text-center">
        <span className="text-shimmer inline-block rounded-full border border-tgex-magenta/50 bg-tgex-magenta/10 px-4 py-1.5 font-bungee text-xs uppercase tracking-[0.2em]">
          Costume Competition
        </span>
        <h1 className="mt-4 font-bungee text-4xl uppercase text-white sm:text-5xl">
          <LetterDrop text="Cosplay Contest" />
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-tgex-light/70">
          Show off your best costume and compete for recognition, and the chance to place on our main stage!
        </p>
      </Reveal>

      {/* Registration Closed */}
      <div className="mb-12 rounded-xl border-2 border-tgex-magenta bg-gradient-to-r from-tgex-magenta/20 to-tgex-indigo/20 p-8 text-center">
        <h2 className="font-bungee text-2xl uppercase text-tgex-magenta">Registration Closed</h2>
        <p className="mx-auto mt-3 max-w-2xl text-tgex-light/80">
          Cosplay contest signups are closed for TGEX 2026. Join us at the West Ballroom Stage to cheer on this year&apos;s contestants live.
        </p>
        <p className="mt-6 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-2 text-sm font-semibold text-white/75">
          Saturday, May 30 at 2:00 PM
        </p>
      </div>

      {/* Contest Details */}
      <div className="mb-12 rounded-xl border border-tgex-teal/30 bg-tgex-teal/10 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-teal">Contest Details</h2>
        <ul className="mt-6 space-y-3 text-tgex-light/80">
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>We will require a short pose or performance, skit, dance, etc. during which you will showcase your cosplay outfit and character. Please prepare ahead of time!</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>Participants must check-in at 1:30pm (30 minutes prior to contest start).</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>Please keep outfits G, PG, or PG13. TGEX aims to be a family-friendly event suitable for all ages.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>NO WEAPONS ARE ALLOWED. All other props must be con-safe (read rules linked below for more info).</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>You will provide a short introduction that the MC will announce prior to your performance.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>Consent to filming/photography of Cosplay Contest, which may be used as promotional media.</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bungee text-tgex-teal">→</span>
            <span>
              A complete set of rules can be found{" "}
              <a
                href="https://docs.google.com/document/d/1hWsUqWYbGsBpJ-EGFDIbenR63ayoRIf5-odIGRk0kNU/edit?tab=t.0#heading=h.4o4c99am2eq7"
                target="_blank"
                rel="noreferrer"
                className="text-tgex-yellow underline decoration-tgex-yellow/60 underline-offset-4 hover:text-white"
              >
                here
              </a>
              . Please be familiar with them ahead of time!
            </span>
          </li>
        </ul>
      </div>

      {/* Rules & Guidelines */}
      <div className="mb-12 rounded-xl border border-tgex-indigo/30 bg-tgex-indigo/10 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-indigo">Rules &amp; Guidelines</h2>
        <div className="mt-6 space-y-6 text-tgex-light/80">
          <div>
            <h3 className="font-bungee text-sm uppercase text-tgex-light">Contest Rules</h3>
            <ul className="mt-3 space-y-3">
              {contestRules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span className="font-bungee text-tgex-indigo">→</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bungee text-sm uppercase text-tgex-light">General Prop Rules</h3>
            <ul className="mt-3 space-y-3">
              {generalPropRules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span className="font-bungee text-tgex-indigo">→</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bungee text-sm uppercase text-tgex-light">Prop Weaponry Specific Rules</h3>
            <ul className="mt-3 space-y-3">
              {propWeaponryRules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span className="font-bungee text-tgex-indigo">→</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bungee text-sm uppercase text-tgex-light">Firearm Prop Specific Rules</h3>
            <ul className="mt-3 space-y-3">
              {firearmRules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span className="font-bungee text-tgex-indigo">→</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bungee text-sm uppercase text-tgex-light">Contact</h3>
            <p className="mt-3 text-sm">
              Questions? Contact Cosplay Contest Coordinators, Megan Ahn (<a className="text-tgex-yellow hover:underline" href="mailto:meahn@ucsd.edu">meahn@ucsd.edu</a> | @a_bakanya on Discord) OR Laila Phillips (<a className="text-tgex-yellow hover:underline" href="mailto:l6phillips@ucsd.edu">l6phillips@ucsd.edu</a> | @lailove on Discord).
            </p>
          </div>
        </div>
      </div>

      {/* Contest Overview */}
      <div className="mb-12 rounded-xl border border-tgex-yellow/30 bg-tgex-yellow/10 p-8">
        <h2 className="font-bungee text-2xl uppercase text-tgex-yellow">Contest Overview</h2>
        <ul className="mt-6 space-y-3 text-tgex-light/80">
          {contestOverview.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="font-bungee text-tgex-yellow">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Back Link */}
      <div className="mt-8 text-center">
        <Link href="/tgex" className="transition-colors text-tgex-teal hover:text-tgex-yellow">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
