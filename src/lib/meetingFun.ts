// The playful bits of meeting check-in: the "question of the meeting" and emoji reactions.
// Client-safe (no server imports) — shared by the portal UI and the API routes.

export const REACTION_EMOJIS = ['🔥', '😂', '👏', '❤️', '🎮', '🤯'] as const;
export const MAX_ANSWER_LENGTH = 140;
export const MAX_QUESTION_LENGTH = 160;

const ICEBREAKERS = [
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
  'Controller, keyboard, or arcade stick?',
  'What game do you secretly rage at but keep playing?',
  'Which game world would you actually want to live in?',
  'What’s one game you think everybody should try?',
  'Which video game villain is secretly right?',
  'What’s the best co-op game you’ve played with a friend?',
  'What game made you cry?',
  'If our club had a mascot from a game, who would it be?',
  'What’s your all-time favorite loading-screen tip or game quote?',
];

export function suggestQuestion(exclude?: string | null): string {
  const pool = ICEBREAKERS.filter((q) => q !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
export const MAX_DESCRIPTION_LENGTH = 200;
