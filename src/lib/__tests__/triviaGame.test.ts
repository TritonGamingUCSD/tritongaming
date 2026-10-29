import { describe, expect, it } from 'vitest';
import {
  cleanCode,
  drawGame,
  isAskable,
  makeCode,
  pointsFor,
  shuffle,
  standings,
  csvToBulk,
  endStats,
  parseBulk,
  suggestSecs,
  topThree,
  totals,
  type PoolQuestion,
} from '../trivia/game';

const q = (id: string, over: Partial<PoolQuestion> = {}): PoolQuestion => ({ id, text: `Question ${id}`, choices: ['a', 'b', 'c', 'd'], correct: 1, category: 'C', ...over });
const seeded =
  (seed = 1) =>
  () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

describe('join code', () => {
  it('makes 6 digits', () => {
    for (let i = 0; i < 200; i++) expect(makeCode()).toMatch(/^[0-9]{6}$/);
  });
  it('cleans what a person typed or pasted', () => {
    expect(cleanCode(' 482 913 ')).toBe('482913');
    expect(cleanCode('482-913')).toBe('482913');
    expect(cleanCode('https://x.test/portal/trivia/play/482913')).toBe('482913');
    expect(cleanCode(' ab3 k9z ')).toBe('AB3K9Z'); // an older game's code, with letters
    expect(cleanCode('48')).toBeNull();
    expect(cleanCode('')).toBeNull();
  });
});

describe('points', () => {
  it('gives 1000 for an instant right answer and 500 at the last second', () => {
    expect(pointsFor(true, 0, 20)).toBe(1000);
    expect(pointsFor(true, 20000, 20)).toBe(500);
    expect(pointsFor(true, 10000, 20)).toBe(750);
  });
  it('gives nothing for a wrong answer and never more than 1000 or less than 500 for a right one', () => {
    expect(pointsFor(false, 0, 20)).toBe(0);
    expect(pointsFor(true, -50, 20)).toBe(1000);
    expect(pointsFor(true, 99999, 20)).toBe(500);
  });
});

describe('drawing a game', () => {
  const pool = Array.from({ length: 12 }, (_, i) => q(`q${i}`));
  it('draws the amount asked, each question once', () => {
    const g = drawGame(pool, new Set(), 5, seeded(3));
    expect(g).toHaveLength(5);
    expect(new Set(g.map((x) => x.id)).size).toBe(5);
  });
  it('never asks for more than the pool holds', () => {
    expect(drawGame(pool, new Set(), 50)).toHaveLength(12);
  });
  it('uses questions no earlier game asked first', () => {
    const used = new Set(pool.slice(0, 8).map((x) => x.id));
    for (let s = 1; s < 20; s++) {
      const ids = drawGame(pool, used, 4, seeded(s)).map((x) => x.id);
      expect(ids.every((id) => !used.has(id))).toBe(true);
    }
    const six = drawGame(pool, used, 6, seeded(7)).map((x) => x.id);
    expect(six.filter((id) => !used.has(id))).toHaveLength(4); // all 4 unused come first, then 2 repeats
  });
  it('skips unfinished questions', () => {
    const mixed = [q('ok'), q('blank', { text: '' }), q('gap', { choices: ['a', '', 'c', 'd'] })];
    expect(drawGame(mixed, new Set(), 10).map((x) => x.id)).toEqual(['ok']);
    expect(isAskable(q('x', { correct: 4 }))).toBe(false);
  });
  it('shuffles the answers and keeps track of the right one', () => {
    for (let s = 1; s < 30; s++) {
      const [one] = drawGame([q('a', { choices: ['w', 'x', 'y', 'z'], correct: 2 })], new Set(), 1, seeded(s));
      expect([...one.choices].sort()).toEqual(['w', 'x', 'y', 'z']);
      expect(one.choices[one.correct]).toBe('y');
    }
  });
  it('shuffle keeps every item', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(9)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('standings', () => {
  const p = (id: string, score: number, time_ms: number) => ({ user_id: id, name: id, score, time_ms });
  it('orders by score, then by the shorter total time', () => {
    const s = standings([p('a', 1000, 9000), p('b', 2000, 20000), p('c', 1000, 5000)]);
    expect(s.map((x) => x.user_id)).toEqual(['b', 'c', 'a']);
    expect(s.map((x) => x.rank)).toEqual([1, 2, 3]);
  });
  it('gives exact ties the same rank', () => {
    const s = standings([p('a', 500, 1000), p('b', 500, 1000), p('c', 100, 1)]);
    expect(s.map((x) => x.rank)).toEqual([1, 1, 3]);
  });
  it('adds up the answers of the players still in', () => {
    const t = totals(
      [
        { user_id: 'a', name: 'A' },
        { user_id: 'b', name: 'B' },
      ],
      [
        { user_id: 'a', points: 900, ms: 2000, ok: true },
        { user_id: 'a', points: 0, ms: 5000, ok: false },
        { user_id: 'gone', points: 1000, ms: 1, ok: true },
        { user_id: 'b', points: 600, ms: 8000, ok: true },
      ],
    );
    expect(t).toEqual([
      { user_id: 'a', name: 'A', score: 900, time_ms: 2000 },
      { user_id: 'b', name: 'B', score: 600, time_ms: 8000 },
    ]);
  });
  it('picks exactly three winners, even through a tie, and nobody on zero', () => {
    const s = standings([p('a', 900, 1), p('b', 900, 1), p('c', 900, 1), p('d', 900, 1), p('z', 0, 0)]);
    expect(topThree(s)).toHaveLength(3);
    expect(topThree(standings([p('a', 100, 1), p('z', 0, 0)])).map((x) => x.user_id)).toEqual(['a']);
  });
});

describe('pasting questions in bulk', () => {
  it('reads * marks, trailing marks, (correct) and Answer lines, with or without blank lines', () => {
    const { questions, problems } = parseBulk(`Category: General
1. What is 2+2?
A. 3
*B. 4
C. 5
D. 6

Q2: Capital of France?
A) Rome
B) Paris *
C) Oslo
D) Bern

Biggest planet?
A. Mars
B. Venus
C. Jupiter (correct)
D. Earth
Which one is a fruit?
A. Car
B. Apple
C. Chair
D. Desk
Answer: B`);
    expect(problems).toEqual([]);
    expect(questions.map((q) => [q.text, q.correct])).toEqual([
      ['What is 2+2?', 1],
      ['Capital of France?', 1],
      ['Biggest planet?', 2],
      ['Which one is a fruit?', 1],
    ]);
    expect(questions[2].choices[2]).toBe('Jupiter');
  });
  it('lists what it cannot read and leaves it out', () => {
    const { questions, problems } = parseBulk('Category: X\nNo right one?\nA. a\nB. b\nC. c\nD. d\n\nTwo answers only\nA. a\n*B. b');
    expect(questions).toEqual([]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/no right answer/);
    expect(problems[1]).toMatch(/four answers/);
  });
});

describe('categories', () => {
  it('reads a Category line before a question, in text and in CSV, and carries it into a drawn game', () => {
    const { questions } = parseBulk(
      'Category: Space\nBiggest planet?\nA. Mars\n*B. Jupiter\nC. Venus\nD. Earth\nSecond one?\nA. a\n*B. b\nC. c\nD. d\nCategory: Gaming\nThird?\nA. a\n*B. b\nC. c\nD. d',
    );
    expect(questions.map((x) => x.category)).toEqual(['Space', 'Space', 'Gaming']);
    expect(parseBulk('Biggest planet?\nA. Mars\n*B. Jupiter\nC. Venus\nD. Earth').problems[0]).toMatch(/no category/);
    const csv = parseBulk(csvToBulk('category,question,A,B,C,D,answer\nSpace,Biggest planet?,Mars,Jupiter,Venus,Earth,B\n'));
    expect(csv.questions[0].category).toBe('Space');
    const game = drawGame([q('1', { category: ' Gaming ' }), q('2')], new Set(), 2, () => 0.5);
    expect(game.map((x) => x.category).sort()).toEqual(['C', 'Gaming']);
  });
});

describe('suggested time', () => {
  it('is roomy, grows with how much there is to read and stays between 40 and 120 seconds', () => {
    const short = suggestSecs({ text: 'Capital of France?', choices: ['Rome', 'Paris', 'Oslo', 'Bern'] });
    const long = suggestSecs({
      text: 'Which of the following university buildings was the first to open on the campus after the founding of the school?',
      choices: ['Scripps Hall of Marine Sciences', 'The old Mandeville auditorium', 'Revelle College humanities library', 'The central Geisel library tower'],
    });
    expect(short).toBeGreaterThanOrEqual(40);
    expect(short % 5).toBe(0);
    expect(long).toBeGreaterThan(short);
    expect(suggestSecs({ text: 'x '.repeat(500), choices: ['', '', '', ''] })).toBe(120);
  });
});

describe('CSV import', () => {
  it('turns question, A to D, answer rows into pasteable questions (header skipped, quotes and answer text understood)', () => {
    const csv = 'category,question,A,B,C,D,answer\r\nGeography,"Capital of France, the city?",Rome,Paris,Oslo,Bern,B\r\nSpace,Biggest planet?,Mars,Venus,Jupiter,Earth,Jupiter\r\n';
    const { questions, problems } = parseBulk(csvToBulk(csv));
    expect(problems).toEqual([]);
    expect(questions.map((q) => [q.text, q.correct])).toEqual([
      ['Capital of France, the city?', 1],
      ['Biggest planet?', 2],
    ]);
  });
});

describe('the end screen facts', () => {
  const plan = [{ text: 'Easy one' }, { text: 'Hard one' }, { text: 'Middle' }];
  const list = [
    { user_id: 'a', name: 'Ann' },
    { user_id: 'b', name: 'Bo' },
    { user_id: 'c', name: 'Cy' },
  ];
  const ans = (user_id: string, q_index: number, ok: boolean, ms = 3000) => ({ user_id, q_index, ok, ms });
  it('finds the quickest answer, the longest streak, the hardest and the easiest question', () => {
    const answers = [
      ans('a', 0, true, 900),
      ans('b', 0, true),
      ans('c', 0, true),
      ans('a', 1, false),
      ans('b', 1, false),
      ans('c', 1, true, 400),
      ans('a', 2, true),
      ans('b', 2, true),
      ans('c', 2, false),
    ];
    const s = endStats(plan, list, answers);
    expect(s.asked).toBe(3);
    expect(s.accuracy).toBe(67);
    expect(s.fastest).toEqual({ name: 'Cy', ms: 400, q: 2 });
    expect(s.streak).toEqual({ name: 'Cy', n: 2 });
    expect(s.hardest).toEqual({ q: 2, text: 'Hard one', pct: 33 });
    expect(s.easiest).toEqual({ q: 1, text: 'Easy one', pct: 100 });
  });
  it('says nothing it cannot back up', () => {
    expect(endStats(plan, list, [])).toEqual({ asked: 0, accuracy: null });
    expect(endStats(plan, list, [ans('a', 0, false), ans('b', 0, false), ans('c', 0, false)]).hardest).toBeUndefined();
  });
});
