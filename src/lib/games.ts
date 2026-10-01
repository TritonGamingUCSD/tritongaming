// Suggested favorites for the profile's game picker — people can still type anything else.
export const GAME_OPTIONS = [
  'Valorant', 'League of Legends', 'Super Smash Bros.', 'Overwatch 2', 'Counter-Strike 2', 'Apex Legends',
  'Rocket League', 'Fortnite', 'Minecraft', 'Genshin Impact', 'Honkai: Star Rail', 'Pokémon', 'Splatoon',
  'Mario Kart', 'Street Fighter', 'Tekken', 'Marvel Rivals', 'Call of Duty', 'Dota 2', 'Teamfight Tactics',
  'Hearthstone', 'Stardew Valley', 'Animal Crossing', 'Zelda', 'Elden Ring', 'Baldur’s Gate 3',
  'Among Us', 'Roblox', 'Rainbow Six Siege', 'Persona',
] as const;

export const GAME_SEPARATOR = ', ';
export const MAX_GAMES = 8;
export const MAX_GAMES_LENGTH = 200; // matches the favorite_games input limit

// Stored as one comma-separated string (the column was free text before this picker).
export function splitStoredGames(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/[,;\n]/).map((g) => g.trim()).filter((g) => {
    const k = g.toLowerCase();
    if (!g || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Common short names people type, mapped onto the picker's names so analytics group them.
const GAME_ALIASES: Record<string, string> = {
  smash: 'Super Smash Bros.', 'smash bros': 'Super Smash Bros.', 'super smash bros': 'Super Smash Bros.', ssbu: 'Super Smash Bros.',
  lol: 'League of Legends', league: 'League of Legends', val: 'Valorant', ow: 'Overwatch 2', overwatch: 'Overwatch 2',
  cs: 'Counter-Strike 2', cs2: 'Counter-Strike 2', csgo: 'Counter-Strike 2', 'cs:go': 'Counter-Strike 2', apex: 'Apex Legends',
  rl: 'Rocket League', genshin: 'Genshin Impact', hsr: 'Honkai: Star Rail', pokemon: 'Pokémon', 'pokémon': 'Pokémon',
  mk: 'Mario Kart', 'mario kart 8': 'Mario Kart', sf: 'Street Fighter', 'street fighter 6': 'Street Fighter', sf6: 'Street Fighter',
  tft: 'Teamfight Tactics', cod: 'Call of Duty', r6: 'Rainbow Six Siege', 'rainbow six': 'Rainbow Six Siege', r6s: 'Rainbow Six Siege',
  'bg3': 'Baldur’s Gate 3', "baldur's gate 3": 'Baldur’s Gate 3', 'zelda: totk': 'Zelda', 'breath of the wild': 'Zelda', botw: 'Zelda', totk: 'Zelda',
  'splatoon 3': 'Splatoon', 'tekken 8': 'Tekken', 'dota': 'Dota 2', 'animal crossing: new horizons': 'Animal Crossing', acnh: 'Animal Crossing',
};
const CANONICAL = new Map<string, string>(GAME_OPTIONS.map((g) => [g.toLowerCase(), g]));

export function normalizeGame(name: string): string {
  const k = name.trim().toLowerCase();
  return CANONICAL.get(k) ?? GAME_ALIASES[k] ?? name.trim();
}

export function parseGames(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return splitStoredGames(value ?? '').map(normalizeGame).filter((g) => !seen.has(g) && !!seen.add(g));
}
