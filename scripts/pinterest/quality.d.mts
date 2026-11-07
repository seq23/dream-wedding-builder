// Types for scripts/pinterest/quality.mjs (tsconfig has allowJs: false).
import type { PinQueue, PinVariant } from '../../lib/pinqueue.mjs';

export declare const THUMB_WIDTH: number;
export declare const MIN_DISTANCE: number;
export declare const RECENT_WINDOW: number;
export declare function dHash(input: Buffer | string): Promise<Uint8Array>;
export declare function distance(a: Uint8Array, b: Uint8Array): number;
export declare function searchTerms(v: PinVariant): string[];
export declare function headlineIssue(v: PinVariant): string | null;
export declare function topicIssue(v: PinVariant): string | null;
export declare function thumbnailIssue(v: PinVariant, text?: unknown): string | null;
export declare function gateQueue(queue: PinQueue, today: string, opts?: Record<string, unknown>): Promise<{ reworked: Array<Record<string, string>>; held: Array<Record<string, string>> }>;
export declare function gateAndReschedule(queue: PinQueue, today: string, opts?: Record<string, unknown>): Promise<{ reworked: Array<Record<string, string>>; held: Array<Record<string, string>> }>;
export declare function gateNewPin(pin: PinVariant, queue: PinQueue, today: string, opts?: Record<string, unknown>): Promise<PinVariant | { held: string }>;
export declare function auditQueue(queue: PinQueue, today: string): Promise<string[]>;
