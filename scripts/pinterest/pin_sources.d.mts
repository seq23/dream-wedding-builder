// Types for scripts/pinterest/pin_sources.mjs (tsconfig has allowJs: false).
import type { PinAngle } from '../../lib/pinqueue.mjs';

export type PageSource = { kind: 'product' | 'guide' | 'hub'; productId: string; name: string; eyebrow: string; facts: string[]; summary: string; text: string };
export declare const HOST: string;
export declare function eligiblePaths(): string[];
export declare function pageSource(pagePath: string): PageSource | null;
export declare function artFor(productId: string): string[];
export declare function topicArt(): { topics: Record<string, { label: string; words: string[]; images: Array<{ file: string; licence: string; focus?: number[] } & Record<string, unknown>> }>; pages: Record<string, { topic: string; search: string[] }> };
export declare function topicFor(pagePath: string): string | null;
export declare function searchesFor(pagePath: string): string[];
export declare function topicImages(topic: string): string[];
export declare function focusFor(art: string): number[];
export declare function topicForText(text: string): string;
export declare function wrapHeadline(name: string): string;
export declare function groupFacts(facts: string[]): string[];
export declare function derivedAngles(pagePath: string): PinAngle[];
export declare function anglesFor(pagePath: string): PinAngle[];
export declare function guideFacts(answer: string | null | undefined): string[];
export declare function wrapQuestion(text: string): string | null;
export declare function questionPin(page: { route: string; query: string }, slConfig: { output: { dir: string; url_prefix: string } }, id: string): (PinAngle & { id: string; seq: number; path: string; layout: string; palette: string; art: string }) | null;
