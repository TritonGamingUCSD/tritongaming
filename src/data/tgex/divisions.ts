export type DivisionIconKey =
  | "league"
  | "splatoon"
  | "melee"
  | "valorant"
  | "fighters"
  | "pokemon"
  | "rivals"
  | "orchestra"
  | "smash"
  | "rhythm"
  | "roblox"
  | "mario-kart"
  | "minecraft"
  | "keebs"
  | "vgdc"
  | "esports"
  | "artspark";

export type DivisionAccent = "teal" | "pink" | "yellow" | "indigo" | "orange" | "magenta";

export type SocialLink = {
  platform: string;
  handle?: string;
  url: string;
};

export type Division = {
  name: string;
  slug: string;
  icon: DivisionIconKey;
  logo: string;
  accent: DivisionAccent;
  shortDescription: string;
  longDescription: string;
  atTgex: string;
  socials: SocialLink[];
};

export const divisions: Division[] = [
  {
    name: "Triton League & TFT",
    slug: "triton-league-and-tft",
    icon: "league",
    logo: "/division logos/TL&T logo.png",
    accent: "teal",
    shortDescription: "Social org for League of Legends, TFT, Riftbound, and LoR — weekly in-houses & more.",
    longDescription:
      "Triton League & TFT is the social org on campus for League of Legends, TFT, Riftbound, and LoR. We hold weekly online in-houses, in-person in-houses @ TEC, host tournaments, watch parties for esports, and plan in-person socials for our community. We announce all of our events through Discord, so be sure to join!",
    atTgex: "Find this division on the stage of East Ballroom on Saturday from 1:00–3:00 PM, and in East Ballroom throughout the weekend!",
    socials: [
      { platform: "Instagram", handle: "leagueoftritons", url: "https://www.instagram.com/leagueoftritons" },
      { platform: "Discord", url: "https://discord.gg/RV8F95h" },
    ],
  },
  {
    name: "Triton Splatoon",
    slug: "triton-splatoon",
    icon: "splatoon",
    logo: "/division logos/Triton_Splatoon_Mascot.png",
    accent: "pink",
    shortDescription: "Play Splatoon and have a blast — events, tournaments, and community for fans of all levels.",
    longDescription:
      "Triton Splatoon is all about playing Splatoon and having a blast! We host events, run tournaments, and bring together fans to connect and compete. Whether you're new or experienced, come join the fun!",
    atTgex: "Find this division in East Ballroom throughout the event!",
    socials: [
      { platform: "Discord", url: "https://discord.gg/dqZY2u7" },
    ],
  },
  {
    name: "Triton Melee",
    slug: "triton-melee",
    icon: "melee",
    logo: "/division logos/TritonMeleeLogo.png",
    accent: "yellow",
    shortDescription: "UCSD's SSBM community — casual and competitive, weekly events at the General Store.",
    longDescription:
      "Triton Melee is the official student organization of UCSD's Super Smash Brothers Melee (SSBM) player-base, casual and competitive alike. As a community, we compete in tournaments, assist in running events, and lend our efforts to supporting the Melee community. Feel free to attend Rage Against the CRT, San Diego's premier weekly! Join us at the General Store @ 6:00 PM every Thursday!",
    atTgex: "Find this division in the Red Shoe Room throughout the weekend!",
    socials: [
      { platform: "Discord", url: "https://discord.gg/M7ExHwpmSr" },
    ],
  },
  {
    name: "Triton Valorant",
    slug: "triton-valorant",
    icon: "valorant",
    logo: "/division logos/TVAL Logo (Color).png",
    accent: "magenta",
    shortDescription: "Do you love Valorant? We love Valorant. Let\u2019s love Valorant together.",
    longDescription:
      "Do you love Valorant? We love Valorant. Let\u2019s love Valorant together.",
    atTgex: "Find this division on-stream on Saturday from 6:00\u20138:00 PM, and in East Ballroom throughout the event!",
    socials: [
      { platform: "Instagram", handle: "triton.valorant", url: "https://www.instagram.com/triton.valorant" },
      { platform: "X", handle: "tritonvalorant", url: "https://x.com/tritonvalorant" },
      { platform: "Discord", url: "https://discord.gg/2nQtQCx2gy" },
    ],
  },
  {
    name: "Triton Fighters",
    slug: "triton-fighters",
    icon: "fighters",
    logo: "/division logos/TF Logo.png",
    accent: "orange",
    shortDescription: "UCSD's FGC home — Street Fighter, Tekken, Guilty Gear, and more, every week.",
    longDescription:
      "Triton Fighters is a student org dedicated to the fighting game community. Every week, we meet on campus to play and talk about various fighting games — Street Fighter, Tekken, Guilty Gear, and the like. We also host tournaments at school events and collaborate with the local San Diego Fighting Game Community.",
    atTgex: "Find this division on the stage of East Ballroom on Sunday from 5:30\u20137:30 PM, and in Marshall Room throughout the event!",
    socials: [
      { platform: "Discord", url: "https://discord.gg/xHVQAhy" },
    ],
  },
  {
    name: "Triton Pokemon League",
    slug: "triton-pokemon-league",
    icon: "pokemon",
    logo: "/division logos/TPL Icon.png",
    accent: "indigo",
    shortDescription: "Tournaments, socials, and weekly hangs for all things Pok\u00e9mon \u2014 TCG, VGC, singles, and more.",
    longDescription:
      "We're Triton Pokemon League, the premier organization for all things related to the Pok\u00e9mon franchise! We host a variety of events throughout the year like competitive tournaments (TCG, VGC, singles, and draft formats) and socials (perler bead night, trivia night, and more). We also have a weekly casual hangout in Price Center Theater where members can play all forms of Pok\u00e9mon together.",
    atTgex: "Find this division in East Ballroom throughout the weekend!",
    socials: [
      { platform: "Instagram", handle: "tritonpokemonleague", url: "https://www.instagram.com/tritonpokemonleague" },
      { platform: "Discord", url: "https://discord.gg/HKAcmGX" },
    ],
  },
  {
    name: "Triton Rivals",
    slug: "triton-rivals",
    icon: "rivals",
    logo: "/division logos/spark.png",
    accent: "pink",
    shortDescription: "UCSD's premier Marvel Rivals org \u2014 game nights, tournaments, and competitive teams.",
    longDescription:
      "Triton Rivals is UCSD's premier Marvel Rivals\u2013focused gaming organization. We host friendly game nights and in-houses, run tournaments for all skill levels, and field two competitive teams \u2014 all in an inclusive environment built for Marvel Rivals enthusiasts.",
    atTgex: "Find this division on the stage of East Ballroom on Sunday from 3:30\u20135:30 PM, and in East Ballroom throughout the event!",
    socials: [
      { platform: "Discord", url: "https://discord.com/invite/xhRz9dyC9F" },
    ],
  },
  {
    name: "Intermission Orchestra",
    slug: "intermission-orchestra",
    icon: "orchestra",
    logo: "/division logos/TIO Logo.png",
    accent: "teal",
    shortDescription: "Student-run orchestra performing music from video games, anime, and films.",
    longDescription:
      "The Intermission Orchestra is a student-run organization dedicated to playing music from video games, anime, and films. We arrange, play, conduct, coordinate rehearsals, and record our performances \u2014 our student power runs practically everything required to manage an orchestra. Since we're self-directed, all members' inputs count: any member has the chance to arrange, and arrangers have the option to conduct their own pieces.",
    atTgex: "Hear this division perform on the stage of East Ballroom on Saturday from 5:00\u20135:30 PM!",
    socials: [
      { platform: "Instagram", handle: "tioatucsd", url: "https://www.instagram.com/tioatucsd" },
      { platform: "Links", url: "https://tiosocialmedia.carrd.co/" },
      { platform: "Website", url: "https://intermissionatucsd.org" },
      { platform: "Discord", url: "https://discord.gg/TeFRnSRyQQ" },
    ],
  },
  {
    name: "Triton Smash",
    slug: "triton-smash",
    icon: "smash",
    logo: "/division logos/TSLogoTransparent (1).png",
    accent: "yellow",
    shortDescription: "Student-run Smash Ultimate org \u2014 bi-weekly tournaments open to all students, staff, and alumni.",
    longDescription:
      "Triton Smash is a student-run organization that supports the Smash Ultimate Community at UCSD. We host bi-weekly tournaments at the Price Center open to all students, staff, and alumni. Events usually take place on Sundays: doors open at 12 while the tournament starts at 1. Join our Discord for updates on our next event.",
    atTgex: "Find this division in the Red Shoe Room throughout the weekend!",
    socials: [
      { platform: "Discord", url: "https://discord.gg/RsUBgtb" },
      { platform: "Start.gg", url: "https://www.start.gg/hub/triton-smash/details" },
    ],
  },
  {
    name: "Dance and Rhythm Game Club",
    slug: "dance-and-rhythm-game-club",
    icon: "rhythm",
    logo: "/division logos/DRGCtransparent.png",
    accent: "magenta",
    shortDescription: "Dance and Rhythm Game Club at UC San Diego!",
    longDescription: "Dance and Rhythm Game Club at UC San Diego!",
    atTgex: "Find this division in West Ballroom throughout the weekend!",
    socials: [
      { platform: "Instagram", handle: "ucsd.drgc", url: "https://www.instagram.com/ucsd.drgc" },
      { platform: "Discord", url: "https://discord.gg/KU89JE6SGA" },
    ],
  },
  {
    name: "Roblox + RBXDev at UCSD",
    slug: "roblox-and-rbxdev-at-ucsd",
    icon: "roblox",
    logo: "/division logos/Roblox + RBXDev.png",
    accent: "indigo",
    shortDescription: "Fostering Roblox and Roblox Development at UCSD \u2014 workshops, game jams, and game nights.",
    longDescription:
      "We foster Roblox and Roblox Development at UCSD! Learn how to develop games on Roblox, and join and participate in our workshops, game jams, and game nights!",
    atTgex: "Find this division in East Ballroom throughout the weekend!",
    socials: [
      { platform: "Instagram", handle: "robloxatucsd", url: "https://www.instagram.com/robloxatucsd" },
      { platform: "LinkTree", url: "https://linktr.ee/robloxatucsd" },
      { platform: "Discord", url: "https://tr.ee/SJxCXWGsQi" },
    ],
  },
  {
    name: "Triton Mario Kart",
    slug: "triton-mario-kart",
    icon: "mario-kart",
    logo: "/division logos/Triton Mario Kart.png",
    accent: "orange",
    shortDescription: "Friendly and competitive Mario Kart in-houses \u2014 MK8 Deluxe, Mario Kart World, online and in-person.",
    longDescription:
      "We are Triton Mario Kart! We host both friendly and competitive in-houses in Mario Kart 8 Deluxe and Mario Kart World, whether online or in-person. Join our Discord to keep up with when these events are held, as well as other social meetups with people in the community!",
    atTgex: "Find this division on the stage of East Ballroom on Sunday from 2:00\u20133:30 PM, and in Roosevelt (ERC) Room throughout the weekend!",
    socials: [
      { platform: "Discord", url: "https://discord.gg/BFw6gdzXzT" },
    ],
  },
  {
    name: "Triton Minecraft",
    slug: "triton-minecraft",
    icon: "minecraft",
    logo: "/division logos/TMC Colored Logo.png",
    accent: "teal",
    shortDescription: "We are a Minecraft club :)",
    longDescription: "We are a Minecraft club :)",
    atTgex: "Find this division in East Ballroom throughout the event!",
    socials: [
      { platform: "Discord", url: "https://discord.com/invite/AHuUG3ukuz" },
    ],
  },
  {
    name: "Keebs at UCSD",
    slug: "keebs-at-ucsd",
    icon: "keebs",
    logo: "/division logos/0UCSD_Keebs_Logo.png",
    accent: "indigo",
    shortDescription: "A community for anyone interested in mechanical keyboards!",
    longDescription: "We are a community for anyone interested in mechanical keyboards!",
    atTgex: "Find this division in West Ballroom on Saturday!",
    socials: [
      { platform: "Instagram", handle: "keebsatucsd", url: "https://www.instagram.com/keebsatucsd" },
      { platform: "LinkTree", url: "https://linktr.ee/ucsdkeebs" },
      { platform: "Website", url: "https://keebsatucsd.com/" },
      { platform: "Discord", url: "https://tr.ee/8ZSqwVLZky" },
    ],
  },
  {
    name: "Video Game Development Club",
    slug: "video-game-development-club",
    icon: "vgdc",
    logo: "/division logos/VGDC Logo.png",
    accent: "orange",
    shortDescription: "UCSD's game dev community \u2014 projects, game jams, workshops, and showcases all year.",
    longDescription:
      "We are the Video Game Development Club @ UCSD! Throughout the year we hold social events, game dev projects, game jams, workshops, and experiences that prioritize growing the game development community.",
    atTgex: "Find this division at showcases in the Multipurpose Room at the Student Services Center throughout the weekend!",
    socials: [
      { platform: "Instagram", handle: "vgdc.ucsd", url: "https://www.instagram.com/vgdc.ucsd" },
      { platform: "Website", url: "https://vgdc.dev" },
      { platform: "Discord", url: "https://discord.gg/t58bndHZ94" },
    ],
  },
  {
    name: "Artspark",
    slug: "artspark",
    icon: "artspark",
    logo: "",
    accent: "pink",
    shortDescription: "A pre-professional art club at UC San Diego dedicated to artists of all levels.",
    longDescription:
      "A pre-professional art club at UC San Diego dedicated to artists of all levels. Come join us on your art journey!",
    atTgex: "Find this division in West Ballroom on Sunday!",
    socials: [
      { platform: "Instagram", handle: "artspark.at.ucsd", url: "https://www.instagram.com/artspark.at.ucsd" },
      { platform: "LinkTree", url: "https://linktr.ee/Art_Spark" },
      { platform: "Discord", url: "https://tr.ee/IX9vZ4qHWW" },
    ],
  },
  {
    name: "UCSD Esports",
    slug: "ucsd-esports",
    icon: "esports",
    logo: "/division logos/Triton_Esports_logo.png",
    accent: "magenta",
    shortDescription: "Fostering inclusive gaming culture through leadership, community, and high-level competition.",
    longDescription:
      "UCSD Esports fosters an inclusive gaming culture by providing leadership and professional development, cultivating spaces that bolster community, showcasing the online personas of our student-athletes, and competing at the highest level.",
    atTgex: "Find this division in East Ballroom throughout the weekend!",
    socials: [
      { platform: "Instagram", handle: "ucsdesports", url: "https://www.instagram.com/ucsdesports" },
      { platform: "X", handle: "ucsdesports", url: "https://x.com/ucsdesports" },
      { platform: "TikTok", handle: "ucsdesports", url: "https://www.tiktok.com/@ucsdesports" },
      { platform: "Website", url: "https://recreation.ucsd.edu/esports/" },
      { platform: "Discord", url: "https://discord.gg/aEM2d4yuMp" },
    ],
  },
];

export function getDivisionBySlug(slug: string): Division | undefined {
  return divisions.find((division) => division.slug === slug);
}
