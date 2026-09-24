#!/usr/bin/env node
// ── normalize-asvab-csv ──
// One shot normalizer for the raw ASVAB math CSVs: reads an input directory of
// `lesson-{n}-{kind}.csv` files and writes importable twins plus a report into
// a sibling output directory, leaving the source untouched.
//
//   cd nexious-scripts
//   npm run normalize:asvab -- --in "<dir of raw csvs>"             writes <dir>/../normalized
//   npm run normalize:asvab -- --in "<dir>" --out "<dir>"           explicit output directory
//   npm run normalize:asvab -- --in "<dir>" --dry                   print the report, write nothing
//
// The transform itself lives in src/study/asvabCsvNormalizer.ts (pure, tested);
// this file owns the filesystem and the exit code. It runs through tsx
// (`node --import tsx`) so the TypeScript module needs no build step, the same
// way `npm test` runs the suite.
//
// EXIT CODE IS THE CONTRACT. Zero means every row in is a row out. Nonzero
// means the report names rows the importer would skip (an empty why with no
// hint steps), a file that could not be read as a lesson file, or a cap the
// source has outgrown. The output files are still written on a nonzero exit,
// because the CLEAN files are importable and the report says which ones; what
// the script refuses to do is pretend the blocked rows went anywhere.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { normalizeFile, renderReport, summarize, MAX_IMPORT_FILE_BYTES } from "../src/study/asvabCsvNormalizer.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const flagValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const inputDir = flagValue("--in") ? resolve(flagValue("--in")) : "";
if (!inputDir || !existsSync(inputDir) || !statSync(inputDir).isDirectory()) {
  console.error("normalize-asvab-csv: --in <directory> is required and must exist.");
  process.exit(1);
}
const outputDir = flagValue("--out") ? resolve(flagValue("--out")) : join(dirname(inputDir), "normalized");
if (resolve(outputDir) === resolve(inputDir)) {
  console.error("normalize-asvab-csv: --out must not be the input directory; the source stays untouched.");
  process.exit(1);
}

const fileNames = readdirSync(inputDir)
  .filter((name) => name.toLowerCase().endsWith(".csv"))
  .sort();
if (fileNames.length === 0) {
  console.error(`normalize-asvab-csv: no .csv files in ${inputDir}.`);
  process.exit(1);
}

const results = fileNames.map((name) => {
  const path = join(inputDir, name);
  const bytes = statSync(path).size;
  // Asserted BEFORE reading, the way the import modal refuses an oversize pick
  // in the queue: a source file past the cap can never be imported whatever
  // this script does to it.
  if (bytes > MAX_IMPORT_FILE_BYTES) {
    const refused = normalizeFile(name, "");
    return { ...refused, fileError: `${bytes} bytes, over MAX_IMPORT_FILE_BYTES ${MAX_IMPORT_FILE_BYTES}` };
  }
  return normalizeFile(name, readFileSync(path, "utf8"));
});

const summary = summarize(results);
const report = renderReport(summary, { inputDir, outputDir, generatedAt: new Date().toISOString() });

console.log(`normalize-asvab-csv: ${basename(inputDir)} -> ${dry ? "(dry run, nothing written)" : outputDir}`);
console.log(`  files: ${results.length}   rows in: ${summary.rowsIn}   rows out: ${summary.rowsOut}`);
for (const kind of ["quiz", "verification", "practice"]) {
  console.log(`  ${kind.padEnd(13)} ${String(summary.byRole[kind].rowsIn).padStart(4)} in  ${String(summary.byRole[kind].rowsOut).padStart(4)} out`);
}
console.log(`  answer not among choices: ${summary.answerMisses}   file errors: ${summary.fileErrors}   cap violations: ${summary.capViolations}`);

if (dry) {
  console.log("");
  console.log(report);
} else {
  mkdirSync(outputDir, { recursive: true });
  let written = 0;
  for (const result of results) {
    if (result.fileError || result.rowsOut === 0) continue;
    writeFileSync(join(outputDir, result.fileName), result.output, "utf8");
    written += 1;
  }
  writeFileSync(join(outputDir, "report.md"), report, "utf8");
  console.log(`  wrote ${written} file(s) and report.md to ${outputDir}`);
}

if (summary.failed) {
  console.error("");
  console.error(
    `normalize-asvab-csv: BLOCKED. ${summary.blockedRows} row(s) in ${summary.blockedFiles} file(s) have an empty why and were NOT passed through` +
      (summary.fileErrors > 0 ? `; ${summary.fileErrors} file(s) could not be normalized` : "") +
      (summary.capViolations > 0 ? `; ${summary.capViolations} cap violation(s)` : "") +
      ". Read report.md before importing."
  );
  process.exit(2);
}
