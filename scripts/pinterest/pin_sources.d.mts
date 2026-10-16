// Types for scripts/pinterest/pin_sources.mjs (tsconfig has allowJs: false).
import type { PinAngle } from '../../lib/pinqueue.mjs';

export type PageSource = { kind: 'product' | 'guide' | 'hub'; productId: string; name: string; eyebrow: string; facts: string[]; summary: string; text: string };
export declare const HOST: string;
export declare function eligiblePaths(): string[];
export declare function pageSource(pagePath: string): PageSource | null;
export declare function artFor(productId: string): string[];
export declare function wrapHeadline(name: string): string;
export declare function groupFacts(facts: string[]): string[];
export declare function derivedAngles(pagePath: string): PinAngle[];
export declare function anglesFor(pagePath: string): PinAngle[];
