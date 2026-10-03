// The playful bits of meeting check-in: the "question of the meeting" and emoji reactions (all of them the club's own custom emojis).
// Client-safe (no server imports) — shared by the portal UI and the API routes.

export const MAX_ANSWER_LENGTH = 140;
export const MAX_QUESTION_LENGTH = 160;

const ICEBREAKERS = [
  // Games
  'What game have you put the most hours into?',
  'What’s the best game you played this month?',
  'Which game character would you want as a roommate?',
  'What’s your most embarrassing in-game moment?',
  'If you could master any game overnight, which one?',
  'What’s a game you love that nobody else seems to play?',
  'What was the first game you ever played?',
  'Which game has the best soundtrack?',
  'What’s your comfort game when you’re stressed?',
  'Which game would you bring back from the dead?',
  'What’s the hardest boss or level you ever beat?',
  'What game do you secretly rage at but keep playing?',
  'Which game world would you actually want to live in?',
  'What’s one game you think everybody should try?',
  'Which video game villain is secretly right?',
  'What’s the best co-op game you’ve played with a friend?',
  'What game made you cry?',
  'If our club had a mascot from a game, who would it be?',
  'What game would you recommend to someone who never plays?',
  'Which game do you wish you could play for the first time again?',
  // Food and drink
  'What’s your go-to late-night snack?',
  'What’s the best meal you’ve had on campus?',
  'What food could you eat every day for a month?',
  'What’s your boba order?',
  'What’s a food you hated as a kid but love now?',
  'What’s your signature dish, even if it’s just instant noodles?',
  'Which cuisine could you never get tired of?',
  'What’s the best thing you’ve eaten this week?',
  'What’s your coffee or tea order?',
  'If you opened a restaurant, what would it serve?',
  // Music, shows, movies, books
  'What song has been on repeat lately?',
  'What’s a show you binged recently?',
  'What’s a movie you can rewatch forever?',
  'What’s the last book or comic you really enjoyed?',
  'Which anime or cartoon shaped your childhood?',
  'What’s a guilty-pleasure song?',
  'What’s the best concert or live show you’ve been to?',
  'What’s a podcast or YouTube channel you’d recommend?',
  'Which fictional world would you want to visit for a day?',
  'What’s a movie everyone loves that you didn’t get?',
  // Life and campus
  'What’s the best thing that happened to you this week?',
  'What’s something small that made you smile today?',
  'What’s your favorite spot on campus?',
  'What class has surprised you the most so far?',
  'What’s your favorite way to procrastinate?',
  'What’s the best advice you got this year?',
  'What’s one thing you’re looking forward to this quarter?',
  'What’s your go-to study spot or study snack?',
  'What’s a tiny thing that always makes your day better?',
  'What’s something you learned recently that you can’t stop telling people?',
  // Would you rather / hypotheticals
  'If you could have dinner with anyone, who would it be?',
  'What superpower would be most useful on a Monday morning?',
  'If you could teleport anywhere right now, where to?',
  'If you had a free day with no obligations, what would you do?',
  'What would you do with a million dollars in the first hour?',
  'If you could instantly learn any skill, what would you pick?',
  'What would your walk-up song be?',
  'If you could live in any decade, which one?',
  'If you were a ghost, who would you haunt and why?',
  'What would you name your pet dragon?',
  // Personal quirks
  'What’s your most useless talent?',
  'What’s a hobby you’d pick up if you had more time?',
  'What’s the weirdest thing you’ve ever collected?',
  'What’s a fun fact about you that most people don’t know?',
  'What’s your most unpopular opinion?',
  'What’s something you’re weirdly good at?',
  'What’s the best gift you’ve ever given or received?',
  'What’s a word or phrase you overuse?',
  'What’s your lock-screen or wallpaper right now?',
  'What emoji do you use the most?',
  // Travel, places, outdoors
  'What’s the best place you’ve ever traveled to?',
  'Where’s somewhere you’d love to go but haven’t yet?',
  'What’s your favorite beach, trail or park?',
  'What’s the most beautiful thing you’ve seen in person?',
  'Where would you move if you could live anywhere?',
  'What’s a hidden gem in San Diego people should know about?',
  'What’s your ideal weekend trip?',
  'What’s the best road trip song?',
  // Creativity and tech
  'If you could design any app, what would it do?',
  'What’s a tech gadget you can’t live without?',
  'What’s one thing you wish existed that doesn’t?',
  'What would your dream setup or workspace look like?',
  'If you could redesign one thing on campus, what would it be?',
  'What’s the coolest thing you’ve built or made?',
  'What’s a skill you want to learn this year?',
  'What’s one thing you’d automate in your life?',
  // Reflection and people
  'Who’s someone that inspires you and why?',
  'What’s something you’re proud of from this year?',
  'What’s the nicest thing someone did for you recently?',
  'What’s one thing you’d tell your first-year self?',
  'What’s a tradition you love?',
  'What’s a compliment you’ll never forget?',
  'What’s the best team you’ve ever been part of?',
  'What makes a meeting actually fun for you?',
  'What’s a goal you have for this quarter?',
  'What’s something you want the club to try?',
  'What event would you love our club to host?',
  // Quick and silly
  'Cats, dogs, or something stranger?',
  'What’s your favorite season and why?',
  'What’s the best smell in the world?',
  'What’s your spirit animal today?',
  'What’s the most overrated thing ever?',
  'What’s the most underrated thing ever?',
  'Breakfast for dinner: yes or no, and why?',
  'What’s the last thing you Googled?',
  'What’s your favorite meme right now?',
  'What would the title of your autobiography be?',
  'What’s one word to describe your week?',
  'Describe your day in three emojis.',
  'What’s the best way to spend a rainy day?',
  'What’s your dream job if money didn’t matter?',
  'What’s the most random skill on your résumé?',
];

export function suggestQuestion(exclude?: string | null): string {
  const pool = ICEBREAKERS.filter((q) => q !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
export const MAX_DESCRIPTION_LENGTH = 200;

// Club custom emojis travel as `custom:<id>` wherever a plain emoji would.
export const CUSTOM_PREFIX = 'custom:';
export const isCustomEmoji = (e: string) => e.startsWith(CUSTOM_PREFIX);
export const customEmojiId = (e: string) => e.slice(CUSTOM_PREFIX.length);
// What reaches the server (hosting caps a request near 4.5 MB); it shrinks the picture to a small 128px WebP before saving. Bigger pictures are
// shrunk in the browser first (see prepareEmojiFile), so people never have to compress anything themselves.
export const MAX_EMOJI_BYTES = 4 * 1024 * 1024;
export const MAX_EMOJI_PICK_BYTES = 30 * 1024 * 1024;
export const EMOJI_NAME = /^[a-z0-9_]{2,20}$/;
export interface CustomEmoji { id: string; name: string; url: string }

// ── Question types: typed answer, this-or-that poll, 1 to 5 rating ──────────────────────────────────────────────
export type QuestionType = 'text' | 'poll' | 'rating';
export const MAX_OPTION_LENGTH = 40;
export const RATING_MAX = 5;

// Poll options from whatever was sent: 2 to 4 unique, trimmed, non-empty choices. null if that isn't what was sent.
export function cleanOptions(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const o of raw) { const t = String(o ?? '').trim().slice(0, MAX_OPTION_LENGTH); if (t && !out.includes(t)) out.push(t); }
  return out.length >= 2 && out.length <= 4 ? out : null;
}
export const asQuestionType = (t: unknown): QuestionType => (t === 'poll' || t === 'rating' ? t : 'text');

// Does this answer fit the question? (polls: one of the options; ratings: 1 to 5; typed: anything non-empty)
export function validAnswer(type: QuestionType, options: string[] | null, answer: string): boolean {
  if (type === 'poll') return !!options?.includes(answer);
  if (type === 'rating') return /^[1-5]$/.test(answer);
  return answer.length > 0;
}

export interface Tally { counts: Record<string, number>; total: number; average: number | null }
export function tally(type: QuestionType, options: string[] | null, answers: string[]): Tally {
  const keys = type === 'poll' ? options ?? [] : type === 'rating' ? ['1', '2', '3', '4', '5'] : [];
  const counts: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const a of answers) if (a in counts) counts[a]++;
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const average = type === 'rating' && total > 0 ? Object.entries(counts).reduce((n, [k, c]) => n + Number(k) * c, 0) / total : null;
  return { counts, total, average };
}

export const POLL_IDEAS: { q: string; options: string[] }[] = [
  { q: 'Controller or keyboard?', options: ['Controller', 'Keyboard'] },
  { q: 'Which would you rather play tonight?', options: ['Co-op', 'Versus', 'Solo'] },
  { q: 'Pick a side', options: ['Console', 'PC'] },
  { q: 'Best way to spend a free hour?', options: ['Ranked grind', 'Cozy game', 'Backlog', 'Watch a stream'] },
  { q: 'Which genre never gets old?', options: ['RPG', 'FPS', 'Platformer', 'Strategy'] },
  { q: 'Speedrun or 100% completion?', options: ['Speedrun', '100% it'] },
  { q: 'Pineapple on pizza?', options: ['Yes', 'No'] },
  { q: 'Early bird or night owl?', options: ['Early bird', 'Night owl'] },
  { q: 'Cats or dogs?', options: ['Cats', 'Dogs'] },
  { q: 'Sweet or salty?', options: ['Sweet', 'Salty'] },
  { q: 'Summer or winter?', options: ['Summer', 'Winter'] },
  { q: 'Beach day or mountain hike?', options: ['Beach', 'Mountain'] },
  { q: 'Which would you pick for the next club social?', options: ['Game night', 'Food crawl', 'Beach day', 'Movie night'] },
  { q: 'Book or movie?', options: ['Book', 'Movie'] },
  { q: 'Text or call?', options: ['Text', 'Call'] },
  { q: 'Window seat or aisle?', options: ['Window', 'Aisle'] },
  { q: 'Coffee, tea, or boba?', options: ['Coffee', 'Tea', 'Boba'] },
  { q: 'Cereal: milk first or cereal first?', options: ['Milk first', 'Cereal first'] },
  { q: 'Would you rather fly or be invisible?', options: ['Fly', 'Invisible'] },
  { q: 'Would you rather always be 10 minutes early or 10 minutes late?', options: ['Early', 'Late'] },
  { q: 'Study spot?', options: ['Library', 'Cafe', 'Dorm or home', 'Outside'] },
  { q: 'Which superpower?', options: ['Time travel', 'Mind reading', 'Teleport', 'Super strength'] },
  { q: 'Your ideal weekend morning?', options: ['Sleep in', 'Gym or run', 'Brunch', 'Gaming'] },
  { q: 'Pick a pet', options: ['Fox', 'Axolotl', 'Capybara', 'Tiny dragon'] },
  { q: 'Dark mode or light mode?', options: ['Dark', 'Light'] },
  { q: 'Phone: Android or iPhone?', options: ['Android', 'iPhone'] },
  { q: 'Hot take: is a hot dog a sandwich?', options: ['Yes', 'No'] },
  { q: 'Pick a snack for the meeting', options: ['Chips', 'Candy', 'Fruit', 'Pizza'] },
  { q: 'Better season for the club?', options: ['Fall', 'Winter', 'Spring'] },
  { q: 'Plan or wing it?', options: ['Plan it', 'Wing it'] },
  { q: 'Karaoke: sing or watch?', options: ['Sing', 'Watch'] },
  { q: 'Which would you try?', options: ['Skydiving', 'Scuba diving', 'Bungee', 'None of them'] },
  { q: 'Pick a time machine stop', options: ['Dinosaurs', 'Medieval', 'Far future', 'The 90s'] },
  { q: 'Music while working?', options: ['Lo-fi', 'Pop', 'Silence', 'Game OST'] },
  { q: 'Which tab is open the most?', options: ['YouTube', 'Discord', 'Docs', 'Too many'] },
  { q: 'Hardest part of the week?', options: ['Monday', 'Midterms', 'Mornings', 'Laundry'] },
  { q: 'Typing: loud keyboard or silent?', options: ['Loud clicky', 'Silent'] },
  { q: 'Which vibe for the next meeting?', options: ['Chill', 'Competitive', 'Creative', 'Chaotic'] },
  { q: 'Cook or order in?', options: ['Cook', 'Order in'] },
  { q: 'Better dessert?', options: ['Ice cream', 'Cake', 'Cookies', 'Fruit'] },
];
export const RATING_IDEAS: string[] = [
  'How hyped are you for this quarter?',
  'How good was your week, 1 to 5?',
  'How much sleep did you get? (1 = none, 5 = a lot)',
  'How ready are you for finals?',
  'Rate your current gaming skill',
  'How energized do you feel right now?',
  'How stressed are you this week? (5 = very)',
  'How excited are you for the next club event?',
  'How would you rate the snacks around campus?',
  'How good was your breakfast today?',
  'How confident are you with your schedule this quarter?',
  'How much did you enjoy last week’s meeting?',
  'How social are you feeling today?',
  'How good is your sense of direction?',
  'How well do you cook?',
  'How good was the last movie or show you watched?',
  'How likely are you to bring a friend next time?',
  'How good is your current playlist?',
  'How caffeinated are you? (5 = vibrating)',
  'How much do you enjoy mornings?',
  'How comfy is your current chair?',
  'How motivated are you to study tonight?',
  'How good is the weather where you are?',
  'How much do you love Mondays?',
  'How creative do you feel today?',
];
export function suggestQuestionOf(type: QuestionType, exclude?: string | null): { question: string; options: string[] | null } {
  if (type === 'poll') { const pool = POLL_IDEAS.filter((p) => p.q !== exclude); const p = pool[Math.floor(Math.random() * pool.length)]; return { question: p.q, options: p.options }; }
  if (type === 'rating') { const pool = RATING_IDEAS.filter((q) => q !== exclude); return { question: pool[Math.floor(Math.random() * pool.length)], options: null }; }
  return { question: suggestQuestion(exclude), options: null };
}

// Pasted from Discord: the emoji's own text `<:pog:123456789012345678>` (`<a:...>` when animated), a cdn.discordapp.com emoji link, or just the number.
export function parseDiscordEmoji(raw: string): { id: string; name: string | null; animated: boolean } | null {
  const t = raw.trim();
  const tag = t.match(/^<(a?):([A-Za-z0-9_~-]{2,32}):(\d{15,22})>$/);
  if (tag) return { id: tag[3], name: tag[2], animated: tag[1] === 'a' };
  const link = t.match(/^https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/emojis\/(\d{15,22})\.(png|webp|gif|jpg|jpeg)(?:\?.*)?$/i);
  if (link) { const q = t.includes('animated=true'); const nm = t.match(/[?&]name=([A-Za-z0-9_~-]{2,32})/); return { id: link[1], name: nm ? nm[1] : null, animated: link[2].toLowerCase() === 'gif' || q }; }
  if (/^\d{15,22}$/.test(t)) return { id: t, name: null, animated: false };
  return null;
}
export const emojiNameFrom = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
