// "Report this answer" on the AI planner's read (Google Play's AI-generated content policy:
// apps that make AI content must let people report or flag it in the app, Play Help 13985936).
// No backend: it opens a pre-filled email to the address the site already uses for questions.
// ON for Android only for now: Dream Wedding 1.0 is Waiting for Review at Apple (19 Nov 2026),
// so the iOS build keeps its reviewed screens. Turn it on for iOS in the next Apple version by
// setting EXPO_PUBLIC_DW_REPORT_AI=1 for that build (or widening the platform check below).
export const REPORT_ADDRESS = 'info@weddingchecklistpdf.com';
const MAX_QUOTED = 1200;

export function reportAnswerShown(platform: string, flag: string | undefined = process.env.EXPO_PUBLIC_DW_REPORT_AI): boolean {
  return platform === 'android' || flag === '1';
}

/** The mailto link: the answer is quoted so the report says what was wrong without a backend. */
export function reportAnswerLink(answer: string, where: string): string {
  const quoted = answer.length > MAX_QUOTED ? answer.slice(0, MAX_QUOTED) + '…' : answer;
  const subject = 'Report an AI answer (Dream Wedding app)';
  const body = `What is wrong with this answer?\n\n\n---\nScreen: ${where}\nThe answer:\n${quoted}`;
  return `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
