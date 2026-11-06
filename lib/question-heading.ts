// Section headings are authored as statements ("One row per guest, always") or as
// imperatives ("Build from venue capacity rules"). Only an imperative can be turned
// into "How do I ...?" and still be a sentence; prefixing a statement produced
// headings such as "How do I one row per guest, always?" on the live sites.
// A statement keeps its authored wording.
export const IMPERATIVE = new Set([
  'adapt', 'add', 'agree', 'anchor', 'ask', 'assign', 'book', 'budget', 'build', 'calculate', 'check', 'choose', 'close',
  'collect', 'compare', 'confirm', 'create', 'decide', 'design', 'distribute', 'end', 'establish', 'finalize', 'finish',
  'freeze', 'give', 'issue', 'keep', 'list', 'make', 'map', 'model', 'move', 'name', 'pack', 'place', 'plan', 'prepare',
  'preserve', 'print', 'protect', 'reconcile', 'record', 'rehearse', 'review', 'schedule', 'separate', 'sequence', 'set',
  'settle', 'share', 'start', 'test', 'total', 'track', 'turn', 'update', 'use', 'write',
]);

export function questionHeading(heading: string): string {
  const text = heading.trim();
  if (text.endsWith('?')) return text;
  const first = text.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!IMPERATIVE.has(first)) return text;
  return `How do I ${text.charAt(0).toLowerCase()}${text.slice(1).replace(/[.:]$/, '')}?`;
}
