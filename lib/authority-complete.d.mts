// Types for lib/authority-complete.mjs. The implementation is plain ESM so that
// Node scripts and the app can import the same function object; this file is what
// lets the TypeScript side (tsconfig has allowJs: false) import it.

export declare const REQUIRED_ARRAY_FIELDS: readonly string[];
export declare const REQUIRED_STRING_FIELDS: readonly string[];
export declare const PLACEHOLDER_PATTERN: RegExp;

export declare const isComplete: (page: unknown) => boolean;
export declare const missingRequiredFields: (page: unknown) => string[];
export declare function findPlaceholders(value: unknown, path?: string): { path: string; value: string }[];
