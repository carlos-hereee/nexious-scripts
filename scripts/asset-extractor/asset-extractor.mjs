#!/usr/bin/env node
/*
 * asset-extractor
 * ---------------------------------------------------------------------------
 * Thin Node wrapper so the Python scene asset extractor is invoked the same way
 * as every other nexious-script, for example:
 *
 *     npm run extract:assets -- ./scene.jpg --out DESIGNS/extracted-assets
 *
 * Everything after the `--` is forwarded verbatim to extract_assets.py.
 *
 * WHY a wrapper: the heavy lifting (semantic segmentation, captioning) lives in
 * Python where the computer vision and ML ecosystem is, but this repo's
 * ergonomics are Node plus `npm run`. This bridges the two without duplicating
 * any logic. It has zero npm dependencies, matching the repo's hand rolled bin
 * style (see bin/random.ts).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "extract_assets.py");

if (!existsSync(SCRIPT)) {
  console.error("asset-extractor: cannot find extract_assets.py next to this wrapper.");
  process.exit(1);
}

// Windows usually exposes `python`; most other systems expose `python3`. Try the
// most likely name first and fall back if the interpreter is not on PATH.
const candidates =
  process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
const forwarded = process.argv.slice(2);

function run(i) {
  if (i >= candidates.length) {
    console.error(
      "asset-extractor: no Python interpreter found. Install Python 3.9+ and run\n" +
        "  pip install -r requirements.txt\n" +
        "inside " + HERE
    );
    process.exit(1);
  }
  const child = spawn(candidates[i], [SCRIPT, ...forwarded], { stdio: "inherit" });
  // ENOENT means this interpreter name is not installed; try the next candidate.
  child.on("error", () => run(i + 1));
  // Any real exit code (including a Python error) is passed straight through.
  child.on("exit", (code) => process.exit(code ?? 0));
}

run(0);
