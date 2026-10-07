import { describe, it, expect } from 'vitest';
import { cleanOptions, parseDiscordEmoji, tally, validAnswer, emojiNameFrom, asQuestionType } from '@/lib/meetings/meetingFun';

describe('discord emoji paste', () => {
  it('reads the emoji text', () => {
    expect(parseDiscordEmoji('<:pog:123456789012345678>')).toEqual({ id: '123456789012345678', name: 'pog', animated: false });
    expect(parseDiscordEmoji('<a:dance:123456789012345678>')).toEqual({ id: '123456789012345678', name: 'dance', animated: true });
  });
  it('reads a copied link, with the name when it has one', () => {
    expect(parseDiscordEmoji('https://cdn.discordapp.com/emojis/123456789012345678.webp?size=48&name=pog&quality=lossless')).toEqual({ id: '123456789012345678', name: 'pog', animated: false });
    expect(parseDiscordEmoji('https://cdn.discordapp.com/emojis/123456789012345678.gif')?.animated).toBe(true);
  });
  it('refuses anything else, so only Discord emoji addresses are ever fetched', () => {
    expect(parseDiscordEmoji('https://evil.example.com/emojis/123456789012345678.png')).toBeNull();
    expect(parseDiscordEmoji('https://cdn.discordapp.com.evil.com/emojis/123456789012345678.png')).toBeNull();
    expect(parseDiscordEmoji('hello')).toBeNull();
  });
  it('makes a usable name', () => { expect(emojiNameFrom('Pog-Face!')).toBe('pog_face'); });
});

describe('poll and rating questions', () => {
  it('keeps 2 to 4 unique options', () => {
    expect(cleanOptions(['A', 'B', 'A', ' '])).toEqual(['A', 'B']);
    expect(cleanOptions(['A'])).toBeNull();
    expect(cleanOptions(['1', '2', '3', '4', '5'])).toBeNull();
    expect(cleanOptions('nope')).toBeNull();
  });
  it('checks an answer fits the question', () => {
    expect(validAnswer('poll', ['A', 'B'], 'A')).toBe(true);
    expect(validAnswer('poll', ['A', 'B'], 'C')).toBe(false);
    expect(validAnswer('rating', null, '5')).toBe(true);
    expect(validAnswer('rating', null, '6')).toBe(false);
    expect(validAnswer('text', null, 'anything')).toBe(true);
  });
  it('tallies votes and averages ratings', () => {
    expect(tally('poll', ['A', 'B'], ['A', 'A', 'B', 'zzz'])).toEqual({ counts: { A: 2, B: 1 }, total: 3, average: null });
    expect(tally('rating', null, ['5', '4']).average).toBe(4.5);
    expect(tally('rating', null, []).average).toBeNull();
  });
  it('treats unknown types as typed', () => { expect(asQuestionType('weird')).toBe('text'); expect(asQuestionType('poll')).toBe('poll'); });
});
