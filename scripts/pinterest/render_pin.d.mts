// Types for scripts/pinterest/render_pin.mjs (tsconfig has allowJs: false).
export declare const W: number;
export declare const H: number;
export declare const LAYOUTS: string[];
export declare const BRAND: string;
export declare const PALETTES: Record<string, { bg: string; ink: string; sub: string }>;
export declare const LEGACY_LAYOUTS: string[];
export declare const LEGACY_PALETTES: string[];
export type TextMetric = { role: string; size: number; lines: string[]; fit: boolean; ink: string; ground: string };
export type ShapeMetric = { layout: string; photo_fraction: number; bands: number; brand: string };
export declare function renderToFile(variant: { id: string; layout: string; palette: string; art: string; eyebrow: string; headline: string; subline: string }, outRel?: string): Promise<{ image: { path: string; type: string; width: number; height: number; length: number }; text: TextMetric[]; shape: ShapeMetric }>;
export declare function closeRenderer(): void;
