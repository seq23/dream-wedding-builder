export const API: string;
export const TOKEN_ENV: string;
export class NamedStop extends Error { code: string; constructor(code: string, why: string); }
export function bufferClient(token: string, fetchImpl?: typeof fetch): (query: string, variables?: Record<string, unknown>) => Promise<any>;
export function readState(call: (q: string, v?: Record<string, unknown>) => Promise<any>, plan: any): Promise<any>;
export function postInput(post: any, platform: string, channelId: string, mediaUrl: (post: any, file: string) => string, text?: string): any;
export function createPost(call: (q: string, v?: Record<string, unknown>) => Promise<any>, input: any): Promise<{ id: string; dueAt?: string }>;
export function waitLive(urls: string[], opts?: { waitMs?: number; everyMs?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }): Promise<void>;
export function planWeek(a: { plan: any; carousels: any[]; video: any; ledger: any; week: number; state: any; roomInQueue: (a: any) => number }): Record<string, any[]>;
