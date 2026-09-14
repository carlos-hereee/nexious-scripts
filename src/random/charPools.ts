// ── charPools ──
// What: shared character pools and length constants used by every language port of the
//   random string generator. Kept in one file so the TypeScript source is the single
//   source of truth; when the Python/Bash/PowerShell ports are regenerated they must
//   mirror these exact values or cross-language output will diverge.
// Who: consumed by src/random/generate.ts (the Node implementation) and the CLI entry.
//   Mirrored by hand in src/random/ports/*.
// Where: this module intentionally has no dependencies so it can be re-exported as a
//   data file from other scripts without pulling in the whole library.

// Character pool for general unique IDs. Matches nexious-library/src/utils/data/uniqueId.tsx
// exactly so IDs generated here are indistinguishable from IDs generated in the UI.
// Includes URL-unsafe and shell-unsafe characters; do not use for secrets pasted into
// .env files, YAML, or shell commands.
export const POOL_FULL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=[]{}|;:,.<>?";

// URL/env/shell-safe alphabet. Same entropy per-character as POOL_FULL minus the 25
// special characters; 62 characters of alphanumeric is still 5.95 bits per char, which
// is plenty for anything you actually need randomness for. Use this for HMAC signing
// secrets, API keys, and anything that will be pasted into a config file.
export const POOL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Hex alphabet. Useful when the consumer expects `openssl rand -hex N` shaped output.
export const POOL_HEX = "0123456789abcdef";

// Segment length and dash-insertion threshold. Must match nexious-library. If you change
// these, regenerate the Python/Bash/PowerShell ports or their output will not match.
export const SEGMENT_LENGTH = 6;
export const DASH_THRESHOLD = 10;
export const DEFAULT_SEGMENTS = 4;
