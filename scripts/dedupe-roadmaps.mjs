// Dedupe roadmaps -> root.
//
// Why this exists: the planning docs were relocated from the company-uno root
// into roadmaps/, but some moves left a stale copy behind at the root. This
// script treats roadmaps/ as the source of truth and removes any root-level
// file that already has a twin (same filename) inside roadmaps/. Files at the
// root that do NOT live in roadmaps/ (CLAUDE.md, WIP.md, the active landing
// copy, anything not yet moved) are never touched, so it cannot delete a doc
// that was meant to stay.
//
// Pure Node, no build step and no dependencies, so it runs straight off disk:
//   node nexious-scripts/scripts/dedupe-roadmaps.mjs            (removes twins)
//   node nexious-scripts/scripts/dedupe-roadmaps.mjs --dry-run  (preview only)
// or via the package alias:
//   cd nexious-scripts && npm run dedupe:roadmaps

import { readdirSync, statSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");

// Derive the repo root from the script's own location rather than from cwd, so
// the script is correct no matter where it is invoked from. This file sits at
// company-uno/nexious-scripts/scripts/, so the company-uno root is two up.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(scriptDir, "..", "..");
const ROADMAPS = join(ROOT, "roadmaps");

// If roadmaps/ is missing there is nothing to dedupe against, and proceeding
// could misread the layout. Bail loudly instead of guessing.
let roadmapEntries;
try {
	roadmapEntries = readdirSync(ROADMAPS);
} catch {
	console.error(`No roadmaps directory found at ${ROADMAPS}. Nothing to do.`);
	process.exit(1);
}

// Only real files directly inside roadmaps/ count as twins. A nested folder
// (eg a leftover roadmap/ shell) is skipped because it is not a doc twin.
const roadmapFiles = new Set(
	roadmapEntries.filter((name) => {
		try {
			return statSync(join(ROADMAPS, name)).isFile();
		} catch {
			return false;
		}
	}),
);

const removed = [];

for (const name of roadmapFiles) {
	const rootTwin = join(ROOT, name);
	let twinStat;
	try {
		twinStat = statSync(rootTwin);
	} catch {
		continue; // no twin at root, nothing to remove
	}
	if (!twinStat.isFile()) continue; // never touch a directory

	// Record whether the root copy still matched the canonical roadmaps copy,
	// purely so the operator can see if a stale/divergent copy was cleared.
	let identical = false;
	try {
		identical = readFileSync(rootTwin).equals(readFileSync(join(ROADMAPS, name)));
	} catch {
		identical = false;
	}

	if (!dryRun) unlinkSync(rootTwin);
	removed.push({ name, identical });
}

// List root-level .md files that have NO twin in roadmaps/, so the operator can
// see exactly what was left in place and why. Scoped to markdown to avoid
// listing build and config noise.
const orphanRootDocs = readdirSync(ROOT)
	.filter((name) => {
		if (!name.toLowerCase().endsWith(".md")) return false;
		if (roadmapFiles.has(name)) return false; // had a twin, handled above
		try {
			return statSync(join(ROOT, name)).isFile();
		} catch {
			return false;
		}
	})
	.sort();

const verb = dryRun ? "Would remove" : "Removed";
console.log(`Dedupe roadmaps -> root  ${dryRun ? "(dry run)" : ""}`.trim());
console.log(`Root:     ${ROOT}`);
console.log(`Roadmaps: ${ROADMAPS}\n`);

if (removed.length) {
	console.log(`${verb} from root (twin exists in roadmaps/):`);
	for (const { name, identical } of removed.sort((a, b) => a.name.localeCompare(b.name))) {
		console.log(`  - ${name}${identical ? "" : "  (root copy differed, was stale)"}`);
	}
} else {
	console.log("Nothing to remove: no root-level file also lives in roadmaps/.");
}

if (orphanRootDocs.length) {
	console.log(`\nLeft in root (.md with no roadmaps/ twin, untouched):`);
	for (const name of orphanRootDocs) console.log(`  - ${name}`);
}

console.log(
	`\nSummary: ${removed.length} ${dryRun ? "would be removed" : "removed"}, ${orphanRootDocs.length} markdown file(s) left at root.`,
);
