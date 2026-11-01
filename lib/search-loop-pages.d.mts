// Types for lib/search-loop-pages.mjs (plain ESM so Node scripts and the Worker share it;
// tsconfig has allowJs: false).
export type SearchLoopConfig = { base_url: string; output?: { url_prefix?: string } };
export type SearchLoopLedger = { pages?: Array<Record<string, unknown>> };
export type SearchLoopPage = { route: string; query: string; lastmod: string | undefined };
export function searchLoopPrefix(config: SearchLoopConfig): string;
export function searchLoopHost(config: SearchLoopConfig): string;
export function searchLoopPages(config: SearchLoopConfig, ledger: SearchLoopLedger): SearchLoopPage[];
export function isSearchLoopPath(config: SearchLoopConfig, pathOrUrl: string): boolean;
