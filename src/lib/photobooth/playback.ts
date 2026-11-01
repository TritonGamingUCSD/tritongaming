/** One moment of the strip playing: which frame of its clip each photo shows (0 = the first moment, `frames - 1` = frozen on the shot). */
export type Tick = number[];

/** How many ticks a photo stays frozen on its shot in the one-by-one pass, and how long all of them stay frozen at the end of the together pass (at 8 ticks a second). */
export const HOLD_EACH = 4;
export const HOLD_END = 12;

/**
 * The strip's playback, one tick at a time: first each photo in turn plays the seconds before its shot and freezes on the shot (the ones before it stay frozen, the ones after wait on their first moment),
 * then every photo plays at once and they all freeze together; then it starts over. With one photo there is only the together pass. `frames` is the length of one photo's clip (the moments before the shot, then the shot).
 */
export function playbackTicks(photos: number, frames: number, holdEach = HOLD_EACH, holdEnd = HOLD_END): Tick[] {
  const last = frames - 1;
  const ticks: Tick[] = [];
  if (photos > 1) {
    for (let p = 0; p < photos; p++) {
      const cells = (at: number): Tick => Array.from({ length: photos }, (_, i) => (i < p ? last : i === p ? at : 0));
      for (let t = 0; t < frames; t++) ticks.push(cells(t));
      for (let h = 0; h < holdEach; h++) ticks.push(cells(last));
    }
  }
  for (let t = 0; t < frames; t++) ticks.push(Array<number>(photos).fill(t));
  for (let h = 0; h < holdEnd; h++) ticks.push(Array<number>(photos).fill(last));
  return ticks;
}
