// Types for scripts/pinterest/quality.mjs (tsconfig has allowJs: false).
import type { PinQueue, PinVariant } from '../../lib/pinqueue.mjs';

export declare const THUMB_WIDTH: number;
export declare const MIN_DISTANCE: number;
export declare const RECENT_WINDOW: number;
export declare function dHash(input: Buffer | string): Promise<Uint8Array>;
export declare function distance(a: Uint8Array, b: Uint8Array): number;
export declare function searchTerms(v: PinVariant): string[];
export declare const MAX_IMAGE_WORDS: number;
export declare const MIN_PHOTO_FRACTION: number;
export declare const MIN_PHOTO_WIDTH: number;
export declare const SALES: RegExp;
export declare function isFrozen(v: PinVariant, config?: PinQueue['config']): boolean;
export declare function salesIssue(v: PinVariant): string | null;
export declare function copyIssue(v: PinVariant): string | null;
export declare function photoIssue(art: string): string | null;
export declare function topicIssue(v: PinVariant): string | null;
export declare function layoutIssue(v: PinVariant, shape?: { layout: string; photo_fraction: number; bands: number; brand: string }): string | null;
export declare function designIssue(v: PinVariant): string | null;
export declare function thumbnailIssue(v: PinVariant, text?: unknown): string | null;
export declare function gateQueue(queue: PinQueue, today: string, opts?: Record<string, unknown>): Promise<{ reworked: Array<Record<string, string>>; held: Array<Record<string, string>> }>;
export declare function gateAndReschedule(queue: PinQueue, today: string, opts?: Record<string, unknown>): Promise<{ reworked: Array<Record<string, string>>; held: Array<Record<string, string>> }>;
export declare function gateNewPin(pin: PinVariant, queue: PinQueue, today: string, opts?: Record<string, unknown>): Promise<PinVariant | { held: string }>;
export declare function auditQueue(queue: PinQueue, today: string, opts?: { all?: boolean }): Promise<string[]>;
