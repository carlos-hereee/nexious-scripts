# 🛠️ Nexious Scripts

A small toolkit of command line utilities used across the nexious ecosystem:
cryptographically strong random string generation, React context codegen, and
filesystem helpers for renaming, copying, and rewriting files in bulk.

> _"Sharpen the tools before swinging the sword."_

---

## Overview

Nexious Scripts started life as a grab bag of shell and Node helpers tacked
onto the UI library. It now stands on its own as a polyglot toolbox:

- **Random string generation**: cryptographic random IDs and secrets with
  matching implementations in TypeScript, Python, Bash, and PowerShell so the
  same output shape works on any stack
- **Codegen**: scaffolds a React context module (provider, reducer, request
  dispatchers) from a single JSON config, so repetitive context boilerplate
  stops being hand written
- **Filesystem helpers**: bulk rename by extension, copy files across trees,
  and pattern replace inside files; used by sibling repos during migrations
- **Cross language ports**: every CLI ships with a portable implementation
  that has no Node runtime requirement, so CI jobs and setup scripts in other
  languages can reach the same primitive

---

## Tech Stack

| Technology                                                  | Purpose                                    |
| ----------------------------------------------------------- | ------------------------------------------ |
| [TypeScript](https://www.typescriptlang.org)                | Source language, strict mode               |
| [Node.js](https://nodejs.org)                               | Runtime for TS builds and bin scripts      |
| [tsc-alias](https://github.com/justkey007/tsc-alias)        | Rewrites `@fs/*`, `@codegen/*` path aliases post compile |
| [tsx](https://tsx.is)                                       | TypeScript test runner via `node --import` |
| [ESLint + Prettier](https://eslint.org)                     | Code quality and formatting                |
| [rimraf](https://github.com/isaacs/rimraf)                  | Cross platform `rm -rf` for clean builds   |
| Python 3 stdlib (`secrets`)                                 | Python port of the random generator        |
| Bash + `/dev/urandom`                                       | POSIX shell port of the random generator   |
| PowerShell + `RandomNumberGenerator`                        | Windows port of the random generator       |

---

## Project Structure

```
nexious-scripts/
├── bin/
│   └── random.ts                 ← CLI entrypoint for `nexious-random`
│
├── src/
│   ├── main.ts                   ← public API surface (re exports)
│   │
│   ├── base/
│   │   └── constants/
│   │       └── SCRIPT_CONSTANTS.ts   ← STATUS_CODES, STATUS_NAMES, shared limits
│   │
│   ├── random/
│   │   ├── charPools.ts          ← full / safe / hex alphabets, segment sizing
│   │   ├── generate.ts           ← canonical TS implementation (crypto.randomInt)
│   │   ├── generate.test.ts      ← colocated vitest / node test shape checks
│   │   └── ports/
│   │       ├── random.py         ← Python stdlib port (secrets.choice)
│   │       ├── random.sh         ← Bash port reading /dev/urandom via od
│   │       └── random.ps1        ← PowerShell port using RandomNumberGenerator
│   │
│   ├── codegen/
│   │   ├── codegen.types.ts      ← TCasing, PWord, ContextConfig
│   │   ├── generateContext.ts    ← CLI entrypoint for `nexious-context`
│   │   ├── buildContext.ts       ← emits the Provider file
│   │   ├── buildReducer.ts       ← emits the reducer file
│   │   └── buildRequest.ts       ← emits request / dispatcher helpers
│   │
│   ├── fs/
│   │   ├── fs.types.ts           ← ErrorName, MessageData, IUpdateFile, IAuthorsPen
│   │   ├── authorsPen.ts         ← visits a tree, invokes cb per matching file
│   │   ├── copyFile.ts           ← fs/promises copy with parent mkdir
│   │   ├── createFile.ts         ← write file if missing, no redundant stat
│   │   ├── loadArgs.ts           ← reads argv JSON from node_modules/nexious-scripts
│   │   ├── readFile.ts           ← JSON aware reader with descriptive errors
│   │   └── updateFile.ts         ← pattern replace with proper error surfacing
│   │
│   ├── shell/
│   │   ├── renameFile.sh         ← canonical bulk rename by extension
│   │   ├── require_path.sh       ← snake_case guard used by other sh scripts
│   │   ├── require_pattern.sh    ← snake_case guard for pattern args
│   │   ├── rename_ext.sh         ← DEPRECATED tombstone → renameFile.sh
│   │   ├── requirePath.sh        ← DEPRECATED tombstone → require_path.sh
│   │   └── requirePattern.sh     ← DEPRECATED tombstone → require_pattern.sh
│   │
│   ├── utils/
│   │   ├── matchString.ts        ← regex match with graceful fallback
│   │   ├── message.ts            ← status message builder (parenthesis safe)
│   │   └── typography.ts         ← casing conversions for codegen
│   │
│   ├── node/                     ← tombstones re exporting @fs/*
│   ├── react/                    ← tombstones re exporting @codegen/*
│   └── @types/                   ← tombstones for legacy ambient module decls
│
├── data/                         ← sample configs for the codegen CLI
├── tsconfig.json                 ← path aliases: @base, @codegen, @fs, @random, @utils
└── package.json                  ← bin: nexious-random, nexious-context
```

---

## Naming Conventions

| What                          | Convention                | Example                       |
| ----------------------------- | ------------------------- | ----------------------------- |
| CLI entry files               | `camelCase.ts`            | `random.ts`, `generateContext.ts` |
| Modules / helpers             | `camelCase.ts`            | `authorsPen.ts`, `buildContext.ts` |
| Type files                    | `name.types.ts`           | `fs.types.ts`, `codegen.types.ts` |
| TS constants                  | `SCREAMING_SNAKE_CASE.ts` | `SCRIPT_CONSTANTS.ts`         |
| Shell scripts                 | `snake_case.sh`           | `require_path.sh`             |
| Port implementations          | `random.<ext>`            | `random.py`, `random.sh`, `random.ps1` |
| Colocated tests               | `name.test.ts`            | `generate.test.ts`            |
| JSON config / data            | `kebab-case.json`         | `context-config.json`         |

Legacy tombstone files keep older camelCase shell names (`requirePath.sh`,
`requirePattern.sh`) so external callers do not break. New work should import
the snake_case canonical versions directly.

---

## Commands

### Bin Scripts

These install onto your `PATH` when the package is globally linked or added as
a dependency with `npm link`.

| Command            | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `nexious-random`   | Generate cryptographically strong random strings        |
| `nexious-context`  | Scaffold a React context module from a JSON config file |

### `nexious-random` Flags

| Flag                  | Short | Description                                                   | Default |
| --------------------- | ----- | ------------------------------------------------------------- | ------- |
| `--length <n>`        | `-l`  | Total character count (excluding dashes)                      | `24`    |
| `--alphabet <name>`   | `-a`  | `full` \| `safe` \| `hex`                                     | `full`  |
| `--no-dashes`         | `-n`  | Emit as one contiguous string (no segment dashes)             | off     |
| `--count <n>`         | `-c`  | Print n strings, one per line                                 | `1`     |
| `--raw`               | `-r`  | Print without trailing newline (for piping into other tools)  | off     |
| `--help`              | `-h`  | Print usage                                                   |         |

Alphabets:
- **full**: matches `nexious-library` uniqueId output, includes symbols
- **safe**: alphanumeric only, URL and env var safe
- **hex**: `0 9` + `a f`, lowercase

### Port Equivalents

The `src/random/ports/` scripts expose the same behavior without requiring Node:

```bash
# POSIX shell
src/random/ports/random.sh -l 32 -a safe

# Python
python3 src/random/ports/random.py --length 32 --alphabet safe

# PowerShell
pwsh src/random/ports/random.ps1 -Length 32 -Alphabet safe
```

### Utility (npm scripts)

| Script                  | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `npm run build`         | Clean, compile, and rewrite path aliases               |
| `npm run clean`         | Remove `dist/` and run Prettier across `src/`          |
| `npm run compile`       | `tsc` + `tsc-alias`                                    |
| `npm run watch:ts`      | `tsc --watch`                                          |
| `npm run watch:alias`   | `tsc-alias --watch`                                    |
| `npm run watch:lint`    | ESLint over `src/**/*.{js,ts}`                         |
| `npm run pretty`        | Run Prettier over `src/`                               |
| `npm run random`        | Invoke `nexious-random` via compiled dist             |
| `npm run generateContext` | Invoke `nexious-context` via compiled dist           |
| `npm test`              | Run colocated vitest / node tests through tsx          |
| `npm run release:patch` | Build, bump patch, publish to npm                      |
| `npm run release:minor` | Build, bump minor, publish to npm                      |
| `npm run release:major` | Build, bump major, publish to npm                      |

---

## System Flow

### ① Random generation

```
user runs nexious-random -l 24 -a full
      │
      ▼
bin/random.ts parses argv (hand rolled, no deps)
      │
      ▼
generateRandomString({ length, alphabet, noDashes })
      │
      ▼
charPools.ts picks pool:
  ├── full  → letters + digits + symbols (matches UI library)
  ├── safe  → alphanumeric only
  └── hex   → 0 9 + a f
      │
      ▼  crypto.randomInt(0, pool.length) per character
      │
      ▼
segment into 6 char chunks joined by "-" when length ≥ 10
      │
      ▼
stdout (optional --raw to skip trailing newline)
```

The Python, Bash, and PowerShell ports follow the same pipeline using each
runtime's CSPRNG (`secrets.choice`, `/dev/urandom`, `RandomNumberGenerator`).

### ② Context codegen

```
user runs nexious-context path/to/context-config.json
      │
      ▼
loadArgs() reads config
      │
      ▼
ContextConfig validated: { name, buildPath, state[], dispatch[], request[] }
      │
      ▼
buildContext.ts       ← emits <Name>Context.tsx Provider
buildReducer.ts       ← emits reducer.ts with one action per state field
buildRequest.ts       ← emits request.ts wrapping fetch dispatchers
      │
      ▼
createFile.ts writes each output into buildPath
      │
      ▼
typography.ts handles naming (upper / lower / camelTo_)
```

### ③ Bulk rename pipeline

```
caller invokes src/shell/renameFile.sh <root> <fromExt> <toExt>
      │
      ▼
require_path.sh guards arg 1 exists
require_pattern.sh guards arg 2 is a valid extension
      │
      ▼
find <root> -type f -name "*.<fromExt>"
      │
      ▼
for each match → mv file to new extension
      │
      ▼
legacy camelCase callers (requirePath.sh, rename_ext.sh) still work
via tombstone files that source / exec the canonical versions
```

---

## Environment Variables

Nexious Scripts has no runtime configuration. The random generator uses the
operating system's CSPRNG directly; no secrets, tokens, or endpoints are
required.

---

## Setup and Installation

```bash
# install dependencies
npm install

# compile TypeScript and rewrite path aliases
npm run build

# link globally so the bin scripts land on your PATH
npm link

# generate a random string
nexious-random -l 32 -a safe

# scaffold a context from a config file
nexious-context ./context-config.json
```

To use as a dependency in a sibling repo:

```bash
npm install --save-dev nexious-scripts

# invoke via npx without global link
npx nexious-random -l 64 -a hex
```

---

## Conventions and Rules

1. **Path aliases for all intra package imports.** Use `@fs/*`, `@codegen/*`,
   `@random/*`, `@base/*`, `@utils/*` rather than relative walks. `tsc-alias`
   rewrites these at build time so the compiled `dist/` has zero runtime alias
   magic.
2. **Keep types next to the code.** Each domain folder owns its own
   `name.types.ts`. Avoid resurrecting ambient `declare module` blocks; they
   drift invisibly between packages.
3. **No raw `fs` outside `src/fs/`.** Route file IO through the helpers so
   error shapes, status codes, and messages stay consistent.
4. **Every port must match the TS shape byte for byte.** If a flag changes in
   `bin/random.ts`, update the Python, Bash, and PowerShell ports in the same
   commit. A divergent port is a silent production bug waiting to hatch.
5. **Tombstones stay one line.** Deprecated files re export or exec the
   canonical target and carry a `DEPRECATED:` header comment naming the
   successor. Do not add logic to a tombstone.
6. **Comments answer the 5Ws when the code is non obvious.** What the block
   does, who calls it, when it runs, where it fits, how it works. Trivial
   wiring is fine without comments; anything requiring a second read is not.
7. **Do not run `tsc --noEmit` or `npm run build` during sessions.** Builds
   are run manually before publish.

---

## Roadmap

- [ ] `nexious-rename` bin script wrapping `renameFile.sh` with cross platform argv handling
- [ ] Retire the `src/@types/`, `src/node/`, and `src/react/` tombstone folders after one release cycle
- [ ] Add a JSON schema for `nexious-context` configs so editors can autocomplete fields
- [ ] Go port of the random generator for backend services that already speak Go
- [ ] Benchmark suite comparing TS / Python / Bash / PowerShell ports on large `--count` runs

---

_Built in the margins between kingdoms. The tool does not care who wields it._
