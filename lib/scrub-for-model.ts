// The one scrub every free-model prompt built from a bride's own words passes through
// (owner decision 13 Nov 2026: Gemini's unpaid terms ask for no personal information, and
// the paid tier is out under the $0 rule, so we cut what we send instead). Email
// addresses, phone numbers, street addresses and web links are replaced before the
// prompt is built. Town, guest count, budget band and tradition are not touched: they
// describe a wedding, not a person. Used by lib/wedding-read.ts and lib/ai-draft.ts.
const RULES: [RegExp, string][] = [
  [/[^\s@<>()"']+@[^\s@<>()"']+\.[a-z]{2,}/gi, '[email removed]'],
  [/\b(?:https?:\/\/|www\.)\S+/gi, '[link removed]'],
  [/\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|co|io|us|me|info|biz|app|shop|uk|ca)\b(?:\/\S*)?/gi, '[link removed]'],
  // A house number followed by up to four words and a street type ("12 Oak Hill Rd", "4500 N Main Street").
  [/\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,4}?(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|terrace|ter|circle|cir|parkway|pkwy|highway|hwy|trail|trl|cove|cv|square|sq)\b\.?(?:\s*(?:#|apt\.?|apartment|suite|ste\.?|unit)\s*[\w-]+)?/gi, '[address removed]'],
  [/(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone removed]']
];

export function scrubForModel(text: string): string {
  let out = text;
  for (const [re, label] of RULES) out = out.replace(re, label);
  return out;
}
