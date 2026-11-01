// Pinterest topic boards (owner-approved 1 Nov 2026): which board, and so which RSS
// feed, every pin belongs to. data/pinterest/boards.json is the one list; the feed
// routes (app/pinfeed.xml, app/pinfeed/[board]) and the drip job read it here.
// Plain ESM so Node scripts and the Worker share it (each passes the parsed JSON in);
// types in pinboards.d.mts.

/** The board functions over one boards.json. */
export function pinBoards(config) {
  const BOARDS = config.boards;
  const SPLIT_FROM = config.split_from;
  const MAIN_BOARD = BOARDS[0];
  if (!BOARDS?.length || !/^\d{4}-\d{2}-\d{2}$/.test(SPLIT_FROM ?? '')) throw new Error('boards.json needs boards[] and split_from YYYY-MM-DD');
  const pathRules = BOARDS.map((b) => ({ board: b, res: b.paths.map((p) => new RegExp(p)) }));

  /** The board a pin belongs to: by its page path, or for a question page by the question's words. */
  function boardFor(pagePath, text = '') {
    if (!pagePath.startsWith('/questions/')) {
      for (const { board, res } of pathRules) if (res.some((re) => re.test(pagePath))) return board;
      return MAIN_BOARD;
    }
    const words = ` ${String(text).toLowerCase().replace(/[^a-z0-9 -]+/g, ' ')} `;
    for (const board of BOARDS.slice(1)) if (board.words.some((w) => words.includes(` ${w} `) || words.includes(` ${w}s `))) return board;
    return MAIN_BOARD;
  }

  /** True when a pin released on `releaseDate` for `board` belongs in `feedBoard`'s feed. Every pin is in exactly one feed. */
  function inFeed(feedBoard, board, releaseDate) {
    if (feedBoard.slug === MAIN_BOARD.slug) return board.slug === MAIN_BOARD.slug || String(releaseDate) < SPLIT_FROM;
    return board.slug === feedBoard.slug && String(releaseDate) >= SPLIT_FROM;
  }

  /** '/pinfeed/small-weddings.xml' -> the board, or null. */
  const boardByFeedPath = (feedPath) => BOARDS.find((b) => b.feed === feedPath) ?? null;

  return { BOARDS, SPLIT_FROM, MAIN_BOARD, boardFor, inFeed, boardByFeedPath };
}

const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

/** The pin title Pinterest indexes: led by a real search term when the title names none of its board's. */
export function pinTitle(title, board) {
  const lower = title.toLowerCase();
  if (board.keywords.some((k) => lower.includes(k))) return clip(title, 100);
  const lead = board.keywords[0].replace(/^./, (c) => c.toUpperCase());
  return clip(`${lead}: ${title}`, 100);
}

/** The pin description, ending with what the click opens (Pinterest's own advice: a clear call to action). */
export function pinDescription(description, pagePath) {
  const cta = pagePath.startsWith('/products/')
    ? 'See every page of the printable before you buy.'
    : pagePath.startsWith('/questions/')
      ? 'Read the short answer and next steps.'
      : 'Open the free checklist on weddingchecklistpdf.com.';
  return `${clip(description, 500 - cta.length - 1)} ${cta}`;
}
