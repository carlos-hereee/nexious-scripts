import crypto from "crypto";
import { POOL_FULL, POOL_SAFE, POOL_HEX, SEGMENT_LENGTH, DASH_THRESHOLD, DEFAULT_SEGMENTS } from "./charPools.js";

// ── generateRandomString ──
// What: produces a cryptographically random string using the same segmentation rules as
//   nexious-library's uniqueId. Supports three alphabets (full, safe, hex) so the same
//   function covers UI IDs, env-safe secrets, and hex tokens.
// Who: called by the CLI entry in bin/random.ts and exported for programmatic use. Port
//   files in src/random/ports/* reimplement this logic; they must stay in lockstep.
// When: safe to call any time. Uses crypto.randomInt which blocks on entropy only in
//   extreme low-entropy boot scenarios; in normal use it returns instantly.
// Where: sits under src/random/ as the canonical Node implementation. Each non-Node port
//   is a translation of this function, not a re-export.
// How:
//   ① Pick the character pool. If caller passes nothing we default to POOL_FULL for
//      parity with the library.
//   ② Compute total character count. length overrides; otherwise use the default of 24
//      (four segments of six).
//   ③ Build a raw string one character at a time via crypto.randomInt. We do NOT use
//      Math.random, it is not cryptographically strong and would quietly leak entropy
//      for anything security-sensitive.
//   ④ If under the dash threshold, return raw. Otherwise split into SEGMENT_LENGTH
//      chunks and join with "-" to match the library's visual format.

export type RandomAlphabet = "full" | "safe" | "hex";

export interface GenerateOptions {
  // Total character count BEFORE dashes are inserted. Default is DEFAULT_SEGMENTS * SEGMENT_LENGTH = 24.
  length?: number;
  // Which character pool to draw from. "full" matches nexious-library; "safe" is
  // alphanumeric only (recommended for env vars, shell args, JSON values); "hex"
  // matches openssl rand -hex output shape.
  alphabet?: RandomAlphabet;
  // Skip dash insertion even if length > DASH_THRESHOLD. Useful when the consumer is a
  // regex or config key that cannot contain dashes.
  noDashes?: boolean;
}

const pickPool = (alphabet: RandomAlphabet): string => {
  switch (alphabet) {
    case "safe":
      return POOL_SAFE;
    case "hex":
      return POOL_HEX;
    case "full":
    default:
      return POOL_FULL;
  }
};

export const generateRandomString = (opts: GenerateOptions = {}): string => {
  const { length, alphabet = "full", noDashes = false } = opts;
  const pool = pickPool(alphabet);
  const totalChars = length ?? DEFAULT_SEGMENTS * SEGMENT_LENGTH;

  // ③ Build raw string. crypto.randomInt is uniformly distributed over [min, max)
  //    which matters when pool.length is not a power of 2 (POOL_FULL is 87, POOL_SAFE is 62).
  let raw = "";
  for (let i = 0; i < totalChars; i++) {
    raw += pool[crypto.randomInt(0, pool.length)];
  }

  // ④ Short strings and explicit no-dash requests return the raw value.
  if (noDashes || totalChars <= DASH_THRESHOLD) return raw;

  // Otherwise chunk into SEGMENT_LENGTH and join with dashes so the output reads like
  // the rest of the library's IDs.
  const segments: string[] = [];
  for (let i = 0; i < raw.length; i += SEGMENT_LENGTH) {
    segments.push(raw.slice(i, i + SEGMENT_LENGTH));
  }
  return segments.join("-");
};

// Convenience helper that mirrors nexious-library's uniqueRandomList: returns N {id} rows.
// Useful for seeding test data.
export const generateRandomList = (count: number, opts: GenerateOptions = {}): { id: string }[] => {
  return Array.from({ length: count }, () => ({ id: generateRandomString(opts) }));
};
