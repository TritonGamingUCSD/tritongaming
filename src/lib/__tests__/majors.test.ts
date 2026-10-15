import { describe, it, expect } from 'vitest';
import { parseMajors } from '@/lib/members/majors';

describe('parseMajors', () => {
  it('cleans abbreviations and splits double majors, each with its field', () => {
    expect(parseMajors('CS / psych')).toEqual({ majors: ['Computer Science', 'Psychology'], fields: ['Engineering & Computing', 'Social Sciences'] });
  });
  it('keeps one field when both majors share it', () => {
    expect(parseMajors('Computer Science, Data Science').fields).toEqual(['Engineering & Computing']);
  });
  it('keeps an unknown major under "Other fields", never the overflow label "Other"', () => {
    expect(parseMajors('Underwater Basket Weaving')).toEqual({ majors: ['Underwater Basket Weaving'], fields: ['Other fields'] });
  });
  it('returns nothing for an empty answer', () => {
    expect(parseMajors('  ')).toEqual({ majors: [], fields: [] });
  });
});
