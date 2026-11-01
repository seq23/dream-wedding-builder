// Types for scripts/authority/sitemap-paths.mjs (tsconfig has allowJs: false).
export function sitemapPathsByHost(root?: string): Record<string, string[]>;
export function searchLoopEntries(root?: string): { host: string | null; pages: Array<{ route: string; query: string; lastmod: string | undefined }> };
export const locFor: (host: string, path: string) => string;
