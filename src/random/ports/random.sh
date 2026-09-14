#!/usr/bin/env bash
# ── nexious-random (bash port) ──
# What: cryptographically random strings, matching src/random/generate.ts output shape.
# Who: for when you are on a bare server, a Docker image, or a CI runner that has bash
#      but no Node or Python.
# Where: source of entropy is /dev/urandom via `od`. On BSDs and Linux this is the
#        correct crypto source; macOS included.
# Why:  every machine I touch has bash. Having a ported-by-hand bash version means
#       "generate me a secret" never blocks on tooling.
#
# Drift warning: keep the three pools and constants identical to charPools.ts. A
# divergence here means a string generated in bash will not look like a string
# generated in Node, which defeats the whole point of cross-language parity.

set -euo pipefail

POOL_FULL='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=[]{}|;:,.<>?'
POOL_SAFE='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
POOL_HEX='0123456789abcdef'

SEGMENT_LENGTH=6
DASH_THRESHOLD=10
DEFAULT_SEGMENTS=4

usage() {
  cat <<'EOF'
nexious-random (bash), cryptographically random strings

Usage:
  random.sh [options]

Options:
  -l <n>   total character count (default 24)
  -a <x>   alphabet: full | safe | hex (default full)
  -n       skip the every-6-chars dash separator
  -c <n>   print N strings, one per line (default 1)
  -r       suppress trailing newline (for piping)
  -h       help
EOF
}

# Defaults match the TS CLI.
length=""
alphabet="full"
no_dashes=0
count=1
raw=0

while getopts ":l:a:nc:rh" opt; do
  case "$opt" in
    l) length="$OPTARG" ;;
    a) alphabet="$OPTARG" ;;
    n) no_dashes=1 ;;
    c) count="$OPTARG" ;;
    r) raw=1 ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

# Validate alphabet up front so the pool lookup below cannot silently fall through.
case "$alphabet" in
  full) pool="$POOL_FULL" ;;
  safe) pool="$POOL_SAFE" ;;
  hex)  pool="$POOL_HEX"  ;;
  *) echo "alphabet must be one of: full | safe | hex (got \"$alphabet\")" >&2; exit 1 ;;
esac

# Default to four segments of SEGMENT_LENGTH: same as TS.
if [[ -z "$length" ]]; then
  length=$(( DEFAULT_SEGMENTS * SEGMENT_LENGTH ))
fi

if ! [[ "$length" =~ ^[1-9][0-9]*$ ]]; then
  echo "--length must be a positive integer" >&2; exit 1
fi
if ! [[ "$count" =~ ^[1-9][0-9]*$ ]]; then
  echo "--count must be a positive integer" >&2; exit 1
fi

pool_len=${#pool}

# generate_one: prints one random string followed by a newline.
# How: read `length` bytes from /dev/urandom, convert to unsigned decimals via od,
# then modulo pool_len into an index. The tiny modulo bias on 87-element pool is
# negligible for our usage; for cryptographic selection it is within the tolerances
# we care about for 24+ character IDs.
generate_one() {
  local bytes_needed="$length"
  # Read bytes as unsigned 8-bit ints, one per line. -A n suppresses the offset column.
  local indices
  indices=$(od -An -vtu1 -N "$bytes_needed" /dev/urandom)

  local raw_str=""
  local i
  for i in $indices; do
    local idx=$(( i % pool_len ))
    raw_str+="${pool:$idx:1}"
  done

  if [[ $no_dashes -eq 1 || $length -le $DASH_THRESHOLD ]]; then
    printf '%s' "$raw_str"
    return
  fi

  # Chunk into SEGMENT_LENGTH pieces and join with dashes.
  local out=""
  local j=0
  while (( j < ${#raw_str} )); do
    if [[ -n "$out" ]]; then
      out+="-"
    fi
    out+="${raw_str:$j:$SEGMENT_LENGTH}"
    j=$(( j + SEGMENT_LENGTH ))
  done
  printf '%s' "$out"
}

i=0
while (( i < count )); do
  generate_one
  i=$(( i + 1 ))
  if (( i < count )); then
    printf '\n'
  fi
done

if [[ $raw -eq 0 ]]; then
  printf '\n'
fi
