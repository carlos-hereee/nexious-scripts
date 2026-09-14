#!/usr/bin/env node

// ── bin/random ──
// What: CLI entry for the random string generator. Exposes the Node implementation in
//   src/random/generate.ts as a terminal command.
// Who: developers. Run as `node dist/bin/random.js [options]` after build, or via the
//   `nexious-random` bin alias declared in package.json.
// When: invoked whenever you need a one-off random string, HMAC secret, API key,
//   session id, test fixture seed.
// How: parses argv by hand (zero deps; this tool is small enough not to warrant
//   commander/cac) and prints the generated string to stdout. Exit 0 on success, 1 on
//   bad args. No trailing newline in --raw mode so pipes to `pbcopy` / `xclip` do not
//   copy an extra character.

import { generateRandomString, RandomAlphabet } from "../src/random/generate.js";

interface Args {
  length?: number;
  alphabet: RandomAlphabet;
  noDashes: boolean;
  count: number;
  raw: boolean;
  help: boolean;
}

const HELP = `nexious-random, cryptographically random strings

Usage:
  nexious-random [options]

Options:
  -l, --length <n>     Total character count (default 24)
  -a, --alphabet <x>   Character pool: full | safe | hex (default full)
                         full = library alphanumeric + special chars (UI IDs)
                         safe = alphanumeric only (env vars, shell, JSON)
                         hex  = 0-9a-f (HMAC secrets, openssl-like)
  -n, --no-dashes      Skip the every-6-chars dash separator
  -c, --count <n>      Print N strings, one per line (default 1)
  -r, --raw            Suppress trailing newline (useful for piping)
  -h, --help           Show this help

Examples:
  nexious-random                           # 24-char full-alphabet ID, dashed
  nexious-random -a safe -l 64 -n          # 64-char env-safe secret, no dashes
  nexious-random -a hex -l 64              # 32-byte hex HMAC secret
  nexious-random -c 10 -a safe -l 32 -n    # 10 env-safe 32-char secrets
`;

const parseArgs = (argv: string[]): Args => {
  const args: Args = { alphabet: "full", noDashes: false, count: 1, raw: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-l":
      case "--length":
        args.length = Number(argv[++i]);
        break;
      case "-a":
      case "--alphabet": {
        const v = argv[++i];
        if (v !== "full" && v !== "safe" && v !== "hex") {
          throw new Error(`alphabet must be one of: full | safe | hex (got "${v}")`);
        }
        args.alphabet = v;
        break;
      }
      case "-n":
      case "--no-dashes":
        args.noDashes = true;
        break;
      case "-c":
      case "--count":
        args.count = Number(argv[++i]);
        break;
      case "-r":
      case "--raw":
        args.raw = true;
        break;
      case "-h":
      case "--help":
        args.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${a}`);
    }
  }
  if (args.length !== undefined && (!Number.isFinite(args.length) || args.length < 1)) {
    throw new Error(`--length must be a positive integer`);
  }
  if (!Number.isFinite(args.count) || args.count < 1) {
    throw new Error(`--count must be a positive integer`);
  }
  return args;
};

const main = () => {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${HELP}`);
    process.exit(1);
  }
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const out: string[] = [];
  for (let i = 0; i < args.count; i++) {
    out.push(generateRandomString({ length: args.length, alphabet: args.alphabet, noDashes: args.noDashes }));
  }

  // --raw: no trailing newline, useful for `nexious-random -r | pbcopy`. Otherwise join
  // with newlines and add a trailing newline as any well-behaved Unix tool would.
  if (args.raw) {
    process.stdout.write(out.join("\n"));
  } else {
    process.stdout.write(out.join("\n") + "\n");
  }
};

main();
