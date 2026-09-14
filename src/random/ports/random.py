#!/usr/bin/env python3
"""
nexious-random: Python port of src/random/generate.ts.

Why this exists:
  The canonical implementation is the TypeScript one in src/random/generate.ts.
  This port mirrors its algorithm, constants, and output shape so a string generated
  in Python is visually and statistically indistinguishable from one generated in
  Node. If you change the TS version, change this one too.

Why Python:
  Most data, scripting, and backend work outside the nexious ecosystem. Having a
  zero-dep (stdlib-only) port means any Python script can get a library-compatible
  ID without pulling the nexious library.

Entropy note:
  We use `secrets` not `random`. `random` is seeded from system time by default and
  is not suitable for anything security-adjacent.
"""

import argparse
import secrets
import sys
from typing import List

# Keep these three pools byte-for-byte identical to charPools.ts. If they drift, the
# "same string on any machine" contract dies.
POOL_FULL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=[]{}|;:,.<>?"
POOL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
POOL_HEX = "0123456789abcdef"

SEGMENT_LENGTH = 6
DASH_THRESHOLD = 10
DEFAULT_SEGMENTS = 4


def _pick_pool(alphabet: str) -> str:
    if alphabet == "safe":
        return POOL_SAFE
    if alphabet == "hex":
        return POOL_HEX
    return POOL_FULL


def generate_random_string(length: int = None, alphabet: str = "full", no_dashes: bool = False) -> str:
    """
    Cryptographically random string, with optional dash-every-6 formatting.

    Keep the signature shape close to the TS version so porting between the two is
    just a matter of renaming arguments.
    """
    pool = _pick_pool(alphabet)
    total_chars = length if length is not None else DEFAULT_SEGMENTS * SEGMENT_LENGTH

    # secrets.choice samples uniformly from the sequence. Equivalent to
    # crypto.randomInt(0, pool.length) on the TS side.
    raw = "".join(secrets.choice(pool) for _ in range(total_chars))

    if no_dashes or total_chars <= DASH_THRESHOLD:
        return raw

    segments: List[str] = [raw[i : i + SEGMENT_LENGTH] for i in range(0, len(raw), SEGMENT_LENGTH)]
    return "-".join(segments)


def _cli() -> int:
    parser = argparse.ArgumentParser(
        prog="nexious-random",
        description="Cryptographically random strings (Python port of the nexious TS generator).",
    )
    parser.add_argument("-l", "--length", type=int, help="total character count (default 24)")
    parser.add_argument("-a", "--alphabet", choices=["full", "safe", "hex"], default="full")
    parser.add_argument("-n", "--no-dashes", action="store_true", help="skip dash separators")
    parser.add_argument("-c", "--count", type=int, default=1, help="number of strings to print")
    parser.add_argument("-r", "--raw", action="store_true", help="suppress trailing newline")
    args = parser.parse_args()

    if args.length is not None and args.length < 1:
        parser.error("--length must be a positive integer")
    if args.count < 1:
        parser.error("--count must be a positive integer")

    lines = [
        generate_random_string(length=args.length, alphabet=args.alphabet, no_dashes=args.no_dashes)
        for _ in range(args.count)
    ]

    # Match the TS CLI's raw-mode behavior: no trailing newline when piping to a
    # clipboard tool; otherwise print normally.
    sys.stdout.write("\n".join(lines))
    if not args.raw:
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
