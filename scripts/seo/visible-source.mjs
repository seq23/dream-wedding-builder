// Normalises a route source file to the content a reader sees, for lastmod.
/**
 * Removes the document-head declarations from a route file before fingerprinting.
 *
 * lastmod is a claim about the content a reader sees. Adding a canonical tag or
 * rewording a meta description changes the file but changes nothing on the page, and
 * counting it would restamp a legal page nobody has edited since May as "changed
 * today" - the same false freshness this ledger exists to remove. Only the imports
 * that exist to feed the metadata block are dropped, so a real component import still
 * registers as a change.
 */
export function stripHeadMetadata(source) {
  const lines = source.split('\n');
  const kept = [];
  let depth = 0;
  let skipping = false;
  for (const line of lines) {
    if (!skipping && /^\s*import\s+\{[^}]*\b(seoMetadata|hubMetadata|guideMetadata|PARENT_HOST)\b[^}]*\}\s+from/.test(line)) continue;
    if (!skipping && /^\s*import\s+type\s+\{\s*Metadata\s*\}\s+from/.test(line)) continue;
    if (!skipping && /^\s*export\s+(const\s+metadata\b|async\s+function\s+generateMetadata\b|function\s+generateMetadata\b)/.test(line)) { skipping = true; depth = 0; }
    if (skipping) {
      for (const char of line) { if (char === '{' || char === '(') depth++; else if (char === '}' || char === ')') depth--; }
      if (depth <= 0) skipping = false;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

/**
 * What a reader can see in a route file: the source minus its head metadata and
 * minus styling. Risk rule R-ADV-12 (no fake freshness): on 6 Nov 2026 the #93
 * redesign changed only className values (rounded-[2rem] -> rounded-[12px]) in
 * app/about, app/methodology, app/photos and others, and the ledger restamped
 * about 12 weddingchecklistpdf.com pages as changed that day. A class or inline
 * style changes the look, never what the page says, so it never moves lastmod.
 * Whitespace is collapsed for the same reason (a reformat is not an edit).
 */
export function visibleSource(source) {
  return stripHeadMetadata(source)
    .replace(/\sclassName=(?:"[^"]*"|'[^']*'|\{`[^`]*`\}|\{"[^"]*"\}|\{'[^']*'\})/g, '')
    .replace(/\sstyle=\{\{[^{}]*\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
