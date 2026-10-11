// Refresh every package's graphify knowledge graph.
//
// Why this exists: each package carries a graphify-out/graph.json that Claude
// orients through (explain/affected/path) before reading files, per the
// "orient via graphify first" working agreement. That graph is a SNAPSHOT of
// the code at build time, so it drifts the moment code changes. A stale graph
// gives wrong answers (missing callers, ghost edges), which is worse than no
// graph because it reads as authoritative. This script re-extracts all four
// package graphs in one pass so the weekly sacred-files/ledger update starts
// from a current map. It is meant to run FIRST in that weekly ritual, so the
// "verify at the live call site" step verifies against a fresh graph.
//
// graphify update is AST-only (no LLM, no API key, nothing leaves the machine),
// so this is cheap and safe to run as often as you like. It uses graphify's
// per-file cache, so unchanged files are skipped and a no-change run is fast.
//
// Pure Node, no build step and no dependencies, so it runs straight off disk:
//   node nexious-scripts/scripts/refresh-graphs.mjs
//   node nexious-scripts/scripts/refresh-graphs.mjs --dry-run   (list only, no work)
// or via the package alias:
//   cd nexious-scripts && npm run refresh:graphs

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");

// Derive the company-uno root from the script's own location rather than from
// cwd, so it is correct no matter where it is invoked from. This file sits at
// company-uno/companyuno-library/nexious-scripts/scripts/, so the workspace root is three up.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(scriptDir, "..", "..", "..");

// Each independent source repository is addressed by its workspace-relative path.
const PACKAGES = [
	"nexious-server",
	"nexious-client",
	"companyuno-library/nexious-library",
	"companyuno-library/nexious-scripts",
	"componyuno-discord-dero/DeroDiscordBot",
];

// A package with no graph yet needs a full --code-only BUILD; one that already
// has a graph.json only needs the cheaper incremental UPDATE. Choosing per
// package keeps the script correct if a new package joins the tree later.
const buildCmd = "graphify . --code-only";
const updateCmd = "graphify update .";

let refreshed = 0;
let built = 0;
let failed = 0;

for (const pkg of PACKAGES) {
	const dir = join(ROOT, pkg);
	if (!existsSync(dir)) {
		console.warn(`  skip   ${pkg}, directory not found`);
		continue;
	}
	const hasGraph = existsSync(join(dir, "graphify-out", "graph.json"));
	const cmd = hasGraph ? updateCmd : buildCmd;
	const verb = hasGraph ? "update" : "build ";

	if (dryRun) {
		console.log(`  ${verb} ${pkg}  (${cmd})`);
		continue;
	}

	try {
		// Inherit stdio so graphify's own progress/warnings surface live; a failed
		// package logs and is counted but never aborts the rest of the sweep.
		process.stdout.write(`\n=== ${verb.trim()} ${pkg} ===\n`);
		execSync(cmd, { cwd: dir, stdio: "inherit" });
		if (hasGraph) refreshed += 1;
		else built += 1;
	} catch (err) {
		failed += 1;
		console.error(`  FAILED ${pkg}: ${err.message}`);
	}
}

if (!dryRun) {
	console.log(
		`\nDone. ${refreshed} updated, ${built} built fresh, ${failed} failed.`,
	);
}
if (failed > 0) process.exitCode = 1;
