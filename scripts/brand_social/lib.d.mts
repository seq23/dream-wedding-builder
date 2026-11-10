// Types for scripts/brand_social/lib.mjs (plain ESM so the daily workflow runs it with node, no build).
export interface MetricsWindow { days: number; since: string; until: string; from: string; to: string }
export interface Referrers { headline_host?: string; platforms: Record<string, string[]> }
export interface HostTally { site_tag: string | null; pageloads: number; first_pageload_date: string | null; social_visits: number; by_platform: { instagram: number; tiktok: number } }
export interface RumRow { count?: number; sum?: { visits?: number }; dimensions?: { siteTag?: string; refererHost?: string; date?: string } }
export interface BufferChannel { id: string; name?: string; displayName?: string | null; service: string }
export interface BufferPost { channelId: string; status: string; sentAt: string | null }
export const WINDOW_DAYS: number;
export const MAX_AGE_DAYS: number;
export const METRIC_FIELDS: string[];
export const PLATFORMS: string[];
export const BEACON_ENDPOINT: string;
export function windowFor(now: number | string | Date): MetricsWindow;
export function platformForReferrer(refererHost: string | null | undefined, referrers: Referrers): 'instagram' | 'tiktok' | null;
export function resolveSiteTags(siteInfo: Array<{ site_tag?: string; site_token?: string; host?: string; ruleset?: { zone_name?: string } }>, hosts: string[]): Record<string, string>;
export function tallyVisits(rows: RumRow[], siteTags: Record<string, string>, referrers: Referrers): Record<string, HostTally>;
export function cloudflareBeacons(html: string): Array<{ token?: string; send?: { to?: string } } | null>;
export function beaconProblem(html: string, expectedToken: string): string | null;
export function visitsDecision(input: { host: string; beaconIssue: string | null; tally: { pageloads: number; social_visits: number } | undefined; window: MetricsWindow }): { value: number } | { unread: string };
export function brandChannels(channels: BufferChannel[], handles: string[]): BufferChannel[];
export function socialHandles(sameAs: string[] | undefined): Array<{ platform: string; handle: string }>;
export function countSentPosts(posts: BufferPost[], channels: Array<{ id: string; service: string }>, window: MetricsWindow): { total: number; byPlatform: Record<string, number> };
export function metricsProblems(metrics: unknown, now?: number): string[];
export function isStale(metrics: unknown, now?: number): boolean;
