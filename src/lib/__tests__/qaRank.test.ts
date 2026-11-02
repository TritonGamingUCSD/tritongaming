import { describe, expect, test } from 'vitest';
import { cleanText, nextQuestion, rankQuestions, type QuestionInfo } from '@/lib/qa/rank';

const q = (id: string, likes: number, at: string, status: QuestionInfo['status'] = 'approved'): QuestionInfo => ({ id, body: id, author: '', status, likes, created_at: at });

describe('Q&A order', () => {
  test('most liked first, then the one asked first', () => {
    const list = [q('a', 1, '2026-01-01T10:00'), q('b', 3, '2026-01-01T10:05'), q('c', 3, '2026-01-01T10:01'), q('d', 0, '2026-01-01T09:00')];
    expect(rankQuestions(list).map((x) => x.id)).toEqual(['c', 'b', 'a', 'd']);
  });
  test('ranking does not change the list it is given', () => {
    const list = [q('a', 0, '1'), q('b', 5, '2')];
    rankQuestions(list);
    expect(list.map((x) => x.id)).toEqual(['a', 'b']);
  });
  test('next is the most liked approved question that is not on the screen', () => {
    const list = [q('a', 5, '1'), q('b', 4, '2'), q('c', 9, '3', 'pending'), q('d', 8, '4', 'hidden'), q('e', 7, '5', 'answered')];
    expect(nextQuestion(list, null)?.id).toBe('a');
    expect(nextQuestion(list, 'a')?.id).toBe('b');
    expect(nextQuestion([list[2], list[3], list[4]], null)).toBeNull();
  });
});

describe('cleaning typed text', () => {
  test('tidies spaces, cuts to length, ignores non-text', () => {
    expect(cleanText('  hello \n  there  ', 50)).toBe('hello there');
    expect(cleanText('abcdef', 3)).toBe('abc');
    expect(cleanText(42, 10)).toBe('');
    expect(cleanText(undefined, 10)).toBe('');
  });
});
