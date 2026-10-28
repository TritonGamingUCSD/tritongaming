import { describe, expect, it } from 'vitest';
import { compareCells, matchesFilter, parseCell } from '@/lib/logistics/sheetMath';

describe('reading a cell', () => {
  it('numbers and prices', () => {
    expect(parseCell('number', ' 12 ', false)).toEqual({ value: 12 });
    expect(parseCell('number', '12.6', false)).toEqual({ value: 13 });
    expect(parseCell('money', '$1,234.5', true)).toEqual({ value: 1234.5 });
    expect(parseCell('number', '', true)).toEqual({ value: null });
    expect('error' in parseCell('number', '', false)).toBe(true);
    expect('error' in parseCell('number', 'abc', true)).toBe(true);
    expect('error' in parseCell('money', '-5', true)).toBe(true);
  });
  it('dates', () => {
    expect(parseCell('date', '2026-10-31', true)).toEqual({ value: '2026-10-31' });
    expect(parseCell('date', '', true)).toEqual({ value: null });
    expect('error' in parseCell('date', '10/31', true)).toBe(true);
  });
  it('text and choices', () => {
    expect(parseCell('text', '  Mouse  ', true)).toEqual({ value: 'Mouse' });
    expect(parseCell('text', '   ', true)).toEqual({ value: null });
    expect(parseCell('select', 'Shelf A', true)).toEqual({ value: 'Shelf A' });
  });
});

describe('sorting', () => {
  it('numbers by value, text with numbers in order, empties last either way', () => {
    expect(compareCells(2, 10, 1)).toBeLessThan(0);
    expect(compareCells('TECM 2', 'TECM 10', 1)).toBeLessThan(0);
    expect(compareCells('b', 'a', -1)).toBeLessThan(0);
    expect(compareCells(null, 3, 1)).toBeGreaterThan(0);
    expect(compareCells(null, 3, -1)).toBeGreaterThan(0);
    expect(compareCells('', '', 1)).toBe(0);
  });
});

describe('filter boxes', () => {
  it('text means contains, capitals ignored', () => {
    expect(matchesFilter('text', 'Razer Mouse', 'mouse')).toBe(true);
    expect(matchesFilter('text', 'Razer Mouse', 'pad')).toBe(false);
    expect(matchesFilter('text', 'anything', '')).toBe(true);
  });
  it('numbers take comparisons', () => {
    expect(matchesFilter('number', 5, '>3')).toBe(true);
    expect(matchesFilter('number', 5, '<3')).toBe(false);
    expect(matchesFilter('number', 5, '>=5')).toBe(true);
    expect(matchesFilter('number', 5, '5')).toBe(true);
    expect(matchesFilter('number', 0, '=0')).toBe(true);
    expect(matchesFilter('number', null, '>0')).toBe(false);
  });
  it('yes / no and empty', () => {
    expect(matchesFilter('bool', true, 'yes')).toBe(true);
    expect(matchesFilter('bool', false, 'yes')).toBe(false);
    expect(matchesFilter('bool', false, 'n')).toBe(true);
    expect(matchesFilter('text', '', 'empty')).toBe(true);
    expect(matchesFilter('text', 'x', '-')).toBe(false);
  });
});
