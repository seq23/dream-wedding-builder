// The one length rule for this repo (owner ruling, 2 Nov 2026: no petty validation).
// Going over a length limit never fails: the generator trims to fit, and a check
// may at most note it. Coming in under a floor fails only below 75% of the floor.
// Every check of a title, description or word count reads these, never its own number.
//
// Plain ESM so Node validators and the TypeScript app share it (allowJs is false;
// types in length-floor.d.mts).

export const FLOOR_SHARE = 0.75;

// Search Readiness bands b1/b2. 65 is where a desktop result truncates a title; a
// description under 120 leaves the snippet half empty. Generators aim for these;
// checks enforce only floorOf(min).
export const TITLE_MIN = 30;
export const TITLE_MAX = 65;
export const DESC_MIN = 120;
export const DESC_MAX = 160;

/** The shortest length that passes a check whose target minimum is `min`. */
export function floorOf(min) {
  return Math.ceil(min * FLOOR_SHARE);
}

/** True only when `length` is below 75% of the target minimum. */
export function belowFloor(length, min) {
  return length < floorOf(min);
}
