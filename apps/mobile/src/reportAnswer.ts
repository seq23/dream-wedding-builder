// "Report this answer" under every AI answer, on every platform (Apple Guideline 1.2 and
// Google Play's AI-generated content policy, Play Help 13985936: people can report AI content
// in the app). No backend: it opens a pre-filled email to the address the site already uses
// for questions, so nothing is stored by us; the person sees and edits the email before sending.
export const REPORT_ADDRESS = 'info@weddingchecklistpdf.com';
const MAX_QUOTED = 1200;

/** The mailto link: the answer is quoted so the report says what was wrong without a backend. */
export function reportAnswerLink(answer: string, where: string): string {
  const quoted = answer.length > MAX_QUOTED ? answer.slice(0, MAX_QUOTED) + '…' : answer;
  const subject = 'Report an AI answer (Dream Wedding app)';
  const body = `What is wrong with this answer?\n\n\n---\nScreen: ${where}\nThe answer:\n${quoted}`;
  return `mailto:${REPORT_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
