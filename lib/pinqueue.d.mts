// Types for lib/pinqueue.mjs (plain ESM so Node scripts and the Worker share it;
// tsconfig has allowJs: false).

export type PinImage = { path: string; type: string; width: number; height: number; length: number };
export type PinVariant = {
  id: string;
  seq: number;
  path: string;
  eyebrow: string;
  headline: string;
  subline: string;
  title: string;
  description: string;
  layout: string;
  palette: string;
  art: string;
  release_date: string | null;
  image?: PinImage;
};
export type PinAngle = { eyebrow: string; headline: string; subline: string; title: string; description: string };
export type PinQueuePage = { path: string; art: string[]; joined: string };
export type PinQueueConfig = {
  pins_per_day: number;
  timezone: string;
  launch_date: string;
  drip_start: string;
  refill_threshold: number;
  refill_batch: number;
  max_feed_items: number;
  layouts: string[];
  palettes: string[];
};
export type PinPace = { since: string; review_after_days: number; fallback: { pins_per_day: number; layouts: string[] }; fell_back_at: string | null; paused_at?: string | null; log: Array<{ at: string; change: string; why: string }> };
export type PinQueue = { config: PinQueueConfig & { pace?: PinPace }; known_pages: string[]; pages: PinQueuePage[]; variants: PinVariant[]; questions?: PinVariant[] };
export type PaceDecision = { action: 'keep' | 'fallback' | 'pause'; reason: string };
export declare function decidePace(config: PinQueueConfig & { pace?: PinPace }, history: Array<{ generated_at?: string; status?: string; total?: number | null }> | null, today: string): PaceDecision;
export declare function applyFallback<T extends PinQueueConfig & { pace?: PinPace }>(config: T, today: string, reason: string): T;

export declare const PIN_TIMEZONE: string;
export declare function chicagoDate(now?: Date): string;
export declare function addDays(isoDate: string, days: number): string;
export declare function pageSlug(path: string): string;
export declare function dueVariants<T extends { id: string; release_date: string | null }>(variants: T[], today: string, max?: number): T[];
export declare function unreleasedCount(variants: Array<{ release_date: string | null }>, today: string): number;
export declare function needsRefill(queue: { config: { refill_threshold: number }; variants: Array<{ release_date: string | null }> }, today: string): boolean;
export declare function scheduleVariants<T extends { path: string; seq: number; id: string; release_date: string | null }>(variants: T[], options: { pinsPerDay: number; firstDay: string }): T[];
export declare function planRefill(queue: PinQueue, pages: Array<{ path: string; art: string[]; angles: PinAngle[] }>, count: number): PinVariant[];
export declare function applyPause<T extends PinQueueConfig & { pace?: PinPace }>(config: T, variants: Array<{ release_date: string | null }>, today: string, reason: string): T;
