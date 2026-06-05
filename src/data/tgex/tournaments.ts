export type TournamentInfo = {
  slug: string;
  name: string;
  game: string;
  location: string;
  time: string;
  signupLink?: string | null;
  streamLink: string | null;
  description: string;
  capacity: string;
  day: string;
  scheduleAnchor: string;
};

export const tournaments: TournamentInfo[] = [
  {
    slug: "neptune-valorant-tournament",
    name: "Neptune Valorant Tournament",
    game: "Valorant",
    location: "Price Center, TEC 2 & East Stage",
    time: "Saturday 12:00 PM - 8:00 PM",
    signupLink: null,
    streamLink: "https://twitch.tv/tritongaming2",
    description:
      "5v5 competitive Valorant tournament with a full-day featured broadcast on TritonGaming2.",
    capacity: "8 teams (40 players)",
    day: "Day 1",
    scheduleAnchor: "/schedule#event-d1-neptune-valorant",
  },
  {
    slug: "league-of-legends-5v5",
    name: "League of Legends 5v5",
    game: "League of Legends",
    location: "Price Center, East Ballroom Floor",
    time: "Saturday Full Day",
    signupLink: null,
    streamLink: "https://twitch.tv/tritongaming3",
    description:
      "5v5 competitive League of Legends bracket tournament throughout the day.",
    capacity: "Multiple teams",
    day: "Day 1",
    scheduleAnchor: "/schedule#event-d1-1v1-lol",
  },
  {
    slug: "1v1-aram",
    name: "1v1 ARAM (League of Legends)",
    game: "League of Legends",
    location: "Price Center, West Ballroom Stage",
    time: "Saturday 5:30 PM - 6:30 PM",
    signupLink: null,
    streamLink: "https://twitch.tv/tritongaming3",
    description:
      "Audience participation showdown where teams coordinate around a shared champion, rune page, and item path in a chaotic ARAM format.",
    capacity: "4 participants",
    day: "Day 1",
    scheduleAnchor: "/schedule#event-d1-1v1-lol",
  },
  {
    slug: "mario-kart-finals",
    name: "Mario Kart Finals",
    game: "Mario Kart",
    location: "Price Center, East Ballroom Stage",
    time: "Sunday 2:00 PM - 3:30 PM",
    signupLink: null,
    streamLink: "https://twitch.tv/tritongaming",
    description:
      "Mario Kart racing finals with competing players battling for the championship title and prizes.",
    capacity: "Multiple finalists",
    day: "Day 2",
    scheduleAnchor: "/schedule#event-d2-mario-kart-stage",
  },
  {
    slug: "fighters-finals",
    name: "Fighters Finals",
    game: "Fighting Games",
    location: "Price Center, East Ballroom Stage",
    time: "Sunday 5:30 PM - 7:30 PM",
    signupLink: null,
    streamLink: "https://twitch.tv/tritongaming",
    description:
      "Fighting game finals featuring the weekend's strongest competitors battling on the main stage, with featured coverage on Triton Gaming and Triton Fighters.",
    capacity: "Multiple finalists",
    day: "Day 2",
    scheduleAnchor: "/schedule#event-d2-fighters-finals",
  },
  {
    slug: "6v6-rivals-finals",
    name: "6v6 Rivals Finals",
    game: "Rivals",
    location: "Price Center, East Ballroom Floor",
    time: "Sunday Full Day",
    signupLink: null,
    streamLink: "https://twitch.tv/tritongaming",
    description:
      "Rivals 2 6v6 team-based finals tournament with large-scale competitive action all day.",
    capacity: "2 teams (12 players)",
    day: "Day 2",
    scheduleAnchor: "/tournaments",
  },
  {
    slug: "high-tide-valorant",
    name: "High Tide Valorant Tournament",
    game: "Valorant",
    location: "Price Center, TEC 2",
    time: "Sunday 12:00 PM - 8:00 PM",
    signupLink: null,
    streamLink: "https://twitch.tv/tritonesports",
    description:
      "5v5 competitive Valorant tournament with full-day featured coverage on the Triton Esports channel.",
    capacity: "8 teams (40 players)",
    day: "Day 2",
    scheduleAnchor: "/schedule#event-d2-high-tide-valorant",
  },
];

export function getTournamentBySlug(slug: string) {
  return tournaments.find((tournament) => tournament.slug === slug);
}
