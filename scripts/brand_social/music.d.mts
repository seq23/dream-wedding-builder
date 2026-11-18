export const PRESETS: Record<string, unknown>;
export function synth(opts: { preset: string; seconds: number; week?: number }): [Float32Array, Float32Array];
export function writeTrack(file: string, opts: { preset: string; seconds: number; week?: number }): string;
export function muxArgs(video: string, wav: string, seconds: number, out: string): string[];
