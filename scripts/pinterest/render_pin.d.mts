// Types for scripts/pinterest/render_pin.mjs (tsconfig has allowJs: false).
export declare const W: number;
export declare const H: number;
export declare const LAYOUTS: string[];
export declare const PALETTES: Record<string, { bg: string; ink: string; accent: string }>;
export declare function renderPin(variant: { id: string; layout: string; palette: string; art: string; eyebrow: string; headline: string; subline: string }): Promise<Buffer>;
