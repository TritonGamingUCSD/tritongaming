import { NextResponse } from 'next/server';
import { FEATURE_SWITCHES } from './featureSwitches';
import { getOffSwitches } from './featureServer';

// The first line of a route that a feature switch can turn off: `const off = await guardFeature('trivia'); if (off) return off;`. Answers 403 with a plain sentence when any of the switches is off, and null when all are on.
export async function guardFeature(...keys: string[]): Promise<NextResponse | null> {
  const off = await getOffSwitches();
  const hit = keys.find((k) => off.includes(k));
  if (!hit) return null;
  const label = FEATURE_SWITCHES.find((s) => s.key === hit)?.label ?? 'This feature';
  return NextResponse.json({ error: `${label} is turned off right now.` }, { status: 403 });
}

/** For the routes that make Live Tools items: a division's item also needs the division Live Tools switch. */
export async function guardDivisionLive(divisionId: unknown): Promise<NextResponse | null> {
  return divisionId ? guardFeature('div_live') : null;
}
