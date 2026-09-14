// ── matchString ──
// What: tests whether `text` matches a regex `pattern`.
// Who: called by updateFile.ts line-by-line.
// Why a wrapper: centralizing this makes it easier to add caching or input validation
//   later without touching every call site.

export const matchString = (text: string, pattern: string): boolean => {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    // A malformed pattern string should not crash a file walk; log and fail open
    // (i.e. no match). If we failed closed (always-match) we would mass-rewrite on
    // syntax errors, which is worse.
    console.error(`matchString: invalid regex pattern "${pattern}"`);
    return false;
  }
};
