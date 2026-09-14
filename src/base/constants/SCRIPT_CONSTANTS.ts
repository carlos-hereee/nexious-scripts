// ── SCRIPT_CONSTANTS ──
// What: the single source of truth for status codes, segment lengths, and other
//   magic numbers used across every script in this package.
// Who: imported by every feature under src/<domain>/ that needs these values.
// Where: sits under base/constants so nothing domain-specific leaks into "things every
//   script needs to know."
// Why constants here: moving magic numbers into a named constants file makes refactors
//   safer (rename the value once), makes diffs readable ("changed DASH_THRESHOLD from
//   10 to 8" is clearer than "changed 10 to 8"), and gives the reader one place to
//   look when asking "what values does this library treat as special?"

export const STATUS_CODES = {
  SUCCESS: 200,
  SKIPPED: 304,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
} as const;

export const STATUS_NAMES = {
  SUCCESS: "success",
  SKIPPED: "skipped",
  BAD_REQUEST: "unknownError",
  MISSING_PROPS: "missingProps",
} as const;

// Random string generator constants. Duplicated from src/random/charPools.ts so that
// consumers importing "@base/constants" get what they expect without pulling in the
// random module. If these diverge from charPools.ts the ports will drift, keep them
// in lockstep or delete one of the two copies.
export const SEGMENT_LENGTH = 6;
export const DASH_THRESHOLD = 10;
export const DEFAULT_SEGMENTS = 4;
