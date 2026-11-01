// Types for lib/pinboards.mjs (tsconfig has allowJs: false).
export type PinBoard = { slug: string; name: string; feed: string; keywords: string[]; paths: string[]; words: string[] };
export type PinBoardsConfig = { split_from: string; boards: PinBoard[] };
export type PinBoards = {
  BOARDS: PinBoard[];
  SPLIT_FROM: string;
  MAIN_BOARD: PinBoard;
  boardFor(pagePath: string, text?: string): PinBoard;
  inFeed(feedBoard: PinBoard, board: PinBoard, releaseDate: string | null | undefined): boolean;
  boardByFeedPath(feedPath: string): PinBoard | null;
};
export declare function pinBoards(config: PinBoardsConfig): PinBoards;
export declare function pinTitle(title: string, board: PinBoard): string;
export declare function pinDescription(description: string, pagePath: string): string;
