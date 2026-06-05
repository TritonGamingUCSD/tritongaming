export type PanelInfo = {
  slug: string;
  name: string;
  speaker: string;
  location: string;
  time: string;
  day: string;
  description: string;
  highlights: string[];
  scheduleAnchor: string;
};

export const panels: PanelInfo[] = [
  {
    slug: "voice-acting-panel",
    name: "So You Wanna Voice Act?",
    speaker: "Amber Lee Connors, Joe Zieja, Nic Olsen",
    location: "Price Center Theater",
    time: "Saturday 1:00 PM – 2:00 PM",
    day: "Day 1",
    description:
      "Want to set foot into the industry? Curious about the process? Whether you're looking for your first role or are interested in the behind-the-scenes, come hear all about it from Amber Lee Connors, Joe Zieja, and Nic Olsen!",
    highlights: [
      "Industry stories from working performers",
      "Advice for aspiring voice actors",
      "Audience Q&A and live discussion",
    ],
    scheduleAnchor: "/schedule#event-d1-va-panel",
  },
  {
    slug: "content-creator-panel",
    name: "Content Creator Panel: Tuonto",
    speaker: "Tuonto",
    location: "Price Center Theater",
    time: "Saturday 3:30 PM – 4:30 PM",
    day: "Day 1",
    description:
      "Look what Teyvat dragged in! From gacha pulls and streaming to music and content creation, Tuonto is here to answer the questions we've been dying to know. Come learn about his journey, experiences, and everything in between!",
    highlights: [
      "Creator workflow and content planning",
      "Community building strategies",
      "Live Q&A for aspiring creators",
    ],
    scheduleAnchor: "/schedule#event-d1-tuonto-panel",
  },
  {
    slug: "careers-at-riot",
    name: "Careers at Riot",
    speaker: "Riot Games professionals",
    location: "Multipurpose Room",
    time: "Saturday 2:00 PM – 3:00 PM",
    day: "Day 1",
    description:
      "Get an inside look at careers at Riot Games, from roles and team structures to what it takes to stand out. Learn directly from Riot professionals about breaking into one of the industry's leading studios.",
    highlights: [
      "Career paths inside game studios",
      "What recruiters look for",
      "Actionable portfolio and application advice",
    ],
    scheduleAnchor: "/schedule#event-d1-careers-riot",
  },
  {
    slug: "alumni-careers",
    name: "Alumni Careers: From UCSD to Industry",
    speaker: "Triton Gaming alumni",
    location: "Multipurpose Room",
    time: "Saturday 3:30 PM – 4:30 PM",
    day: "Day 1",
    description:
      "Hear from Triton Gaming's own alumni as they share their journeys from campus to careers in gaming and tech. Learn how they got their start, what they wish they knew, and how you can follow a similar path.",
    highlights: [
      "Real career journeys from UCSD grads",
      "Lessons learned transitioning to industry",
      "Advice for students exploring gaming careers",
    ],
    scheduleAnchor: "/schedule#event-d1-alumni-panel",
  },
  {
    slug: "bringing-characters-to-life",
    name: "Bringing Your Favorite Characters to Life!",
    speaker: "Lilypichu, Risa Mei, Stephanie Southerland",
    location: "Price Center Theater",
    time: "Sunday 12:30 PM – 1:30 PM",
    day: "Day 2",
    description:
      "Ever wonder how your favorite characters are brought to life? Now you can find out! Join Lilypichu, Risa Mei, and Stephanie Southerland as they share their experiences with voicing your favs!",
    highlights: [
      "Behind-the-scenes voice acting stories",
      "Character research and preparation",
      "Live Q&A with panelists",
    ],
    scheduleAnchor: "/schedule#event-d2-va-panel",
  },
  {
    slug: "indie-games-showcase",
    name: "From Indie to Iconic: Supergiant & The Behemoth",
    speaker: "Supergiant Games & The Behemoth developers",
    location: "Multipurpose Room",
    time: "Sunday 2:00 PM – 3:00 PM",
    day: "Day 2",
    description:
      "Developers from Supergiant Games and The Behemoth share how they built standout indie titles. Explore the creative process, challenges, and decisions behind making games that resonate.",
    highlights: [
      "Behind-the-scenes development stories",
      "Design lessons from indie teams",
      "Discussion on pitching and demoing games",
    ],
    scheduleAnchor: "/schedule#event-d2-indie-game-panel",
  },
  {
    slug: "how-to-get-a-job",
    name: "How to Get a Job in the Current Games Industry",
    speaker: "Riot Games professionals",
    location: "Multipurpose Room",
    time: "Sunday 4:00 PM – 5:00 PM",
    day: "Day 2",
    description:
      "Breaking into the games industry can be tough. Riot professionals share practical advice on resumes, portfolios, networking, skills, and how to navigate today's competitive job market.",
    highlights: [
      "Resume and portfolio best practices",
      "Networking strategies",
      "Navigating a competitive job market",
    ],
    scheduleAnchor: "/schedule#event-d2-how-to-job",
  },
  {
    slug: "breaking-into-esports",
    name: "Breaking Into Esports: NRG & FlyQuest",
    speaker: "NRG Esports & FlyQuest professionals",
    location: "Price Center Theater",
    time: "Sunday 3:30 PM – 4:30 PM",
    day: "Day 2",
    description:
      "Professionals from NRG Esports and FlyQuest discuss careers in esports beyond playing. Learn about roles in operations, marketing, partnerships, and what it takes to enter the competitive esports space.",
    highlights: [
      "Careers in esports operations and marketing",
      "Paths into the competitive gaming industry",
      "Insights from NRG and FlyQuest team members",
    ],
    scheduleAnchor: "/schedule#event-d2-esports-panel",
  },
];

export function getPanelBySlug(slug: string) {
  return panels.find((panel) => panel.slug === slug);
}
