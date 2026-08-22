#!/usr/bin/env node
// ── roll-sacred ──
// The monthly roll for SACRED_FILES. Run it on the first working session of a new month:
//
//   cd nexious-scripts && npm run roll:sacred            (roll into the current month)
//   npm run roll:sacred -- --month 2026-09               (roll into a named month)
//   npm run roll:sacred -- --dry                         (print the plan, write nothing)
//
// What it does, and why each part exists:
//   1. Creates SACRED_FILES/<new-month>/ with FUTURE_PLANS.md, WIP.md and HISTORICAL.md.
//   2. Carries the OPEN items forward from last month's FUTURE_PLANS, RENUMBERED FROM 1. Closed
//      items stay in the month they closed in, which is what keeps the new file light.
//   3. Writes the carry-over header: source month, that month's last number, and the full
//      old-to-new map. This is the cookie trail, and it is the whole reason this is a script
//      rather than a checklist: a carried item that silently changes number turns every existing
//      reference to it into a lie, and nobody notices until they follow one.
//   4. Appends a row to the ID registry in SACRED_FILES/README.md.
//
// What it deliberately does NOT do:
//   • Touch STATE.md or TECH_DEBT.md. They describe what is true NOW, so a monthly reset would
//     mean starting each month claiming the platform has no features and no known defects.
//   • Rotate WIP by DATE. Deploy state decides what is history (see the README); an unreleased
//     week is not history however old it looks, and this script will not guess. It seeds the new
//     WIP with a header and leaves last month's alone.
//   • Delete anything. A sealed month is kept verbatim.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SACRED = join(ROOT, "SACRED_FILES");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const monthArg = args[args.indexOf("--month") + 1];
const targetMonth =
  args.includes("--month") && monthArg && /^\d{4}-\d{2}$/.test(monthArg)
    ? monthArg
    : new Date().toISOString().slice(0, 7);

/** Month folders present, oldest first. The newest that is not the target is what we carry from. */
const monthFolders = () =>
  readdirSync(SACRED, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

/**
 * Split a FUTURE_PLANS body into its `## N. Title` items.
 *
 * Anchored to the start of a line so a "## 3." quoted inside prose cannot open a phantom item, and
 * the preamble (everything before the first item) is returned separately because it holds the
 * priority index and the era header, neither of which is an item.
 */
const parseItems = (body) => {
  const lines = body.split(/\r?\n/);
  const starts = [];
  // Headings this parser CANNOT represent. A LETTERED item such as
  // `## 37a. Calendar-name and store-name field decisions` does not match the bare-number form, so
  // it used to be invisible: the roll reported 101 items against a file holding 102 headings,
  // carried the 101 forward, and left the lettered one behind in a month about to be sealed with
  // nothing pointing at it. Silent data loss on the one system this repo treats as sacred.
  //
  // Collected rather than parsed on purpose. Carrying `37a` forward means deciding what it BECOMES,
  // its own number or a sub-item of whatever 37 renumbers to, and numbering is the decision this
  // system refuses to make by accident. The caller refuses the roll and names the heading instead.
  const lettered = [];
  lines.forEach((line, index) => {
    const match = /^##\s+(\d+)\.\s+(.*)$/.exec(line);
    if (match) {
      starts.push({ index, number: Number(match[1]), title: match[2] });
      return;
    }
    const suffixed = /^##\s+(\d+[a-zA-Z]+)\.\s+(.*)$/.exec(line);
    if (suffixed) lettered.push({ line: index + 1, id: suffixed[1], title: suffixed[2] });
  });
  const preamble = starts.length ? lines.slice(0, starts[0].index).join("\n") : body;
  const items = starts.map((start, i) => ({
    number: start.number,
    title: start.title,
    text: lines.slice(start.index, starts[i + 1] ? starts[i + 1].index : lines.length).join("\n"),
  }));
  return { preamble, items, lettered };
};

/**
 * Is this item CLOSED?
 *
 * Deliberately conservative: an item counts as closed only when its heading itself is struck
 * through or its status line opens with DONE/SHIPPED/MOOT. Anything ambiguous is carried FORWARD,
 * because wrongly carrying a closed item costs one line of clutter that a human deletes, while
 * wrongly dropping an open one loses tracked work silently. That asymmetry decides the default.
 */
const isClosed = (item) => {
  if (/^~~.*~~/.test(item.title.trim())) return true;
  const status = /\*\*Status\.\*\*\s*(.{0,80})/.exec(item.text);
  return Boolean(status && /^\*{0,2}(DONE|SHIPPED|MOOT|CLOSED)\b/i.test(status[1].trim()));
};

const pad = (n) => String(n).padStart(2, "0");
const prevMonthOf = (month) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
};

const main = () => {
  if (!existsSync(SACRED)) {
    console.error(`roll-sacred: ${SACRED} does not exist. Nothing to roll.`);
    process.exit(1);
  }
  const months = monthFolders();
  const source = months.filter((m) => m < targetMonth).pop();
  if (!source) {
    console.error(`roll-sacred: no month folder older than ${targetMonth} to carry from.`);
    process.exit(1);
  }
  const targetDir = join(SACRED, targetMonth);
  if (existsSync(targetDir) && !dry) {
    console.error(`roll-sacred: ${targetMonth} already exists. A month is rolled once; refusing to overwrite.`);
    process.exit(1);
  }

  // A month's FUTURE_PLANS may be SPLIT ACROSS PARTS. 2026-08 was split on 2026-08-07 by owner
  // decision, because one file had reached ~50k tokens against rule 18's 25k ceiling: part 1 holds
  // items 1 to 50, `FUTURE_PLANS-PART-2.md` holds 51 and up. Reading only part 1 would carry the
  // low-numbered half forward and SILENTLY DROP the rest, which is the kind of loss this script
  // exists to prevent. Parts are read in order and concatenated, so item order and numbering are
  // exactly what a single file would have produced.
  const sourceParts = [
    join(SACRED, source, "FUTURE_PLANS.md"),
    ...[2, 3, 4, 5].map((n) => join(SACRED, source, `FUTURE_PLANS-PART-${n}.md`)),
  ].filter((path) => existsSync(path));
  if (!sourceParts.length) {
    console.error(`roll-sacred: ${source} has no FUTURE_PLANS.md to carry from.`);
    process.exit(1);
  }
  const parsed = sourceParts.map((path) => ({ path, ...parseItems(readFileSync(path, "utf8")) }));
  // Refuse on a lettered item rather than dropping it. Same posture as the duplicate-number check
  // below: the roll never guesses at an id, because every id it mints is referenced from HISTORICAL,
  // from code comments, and from memories that outlive the session that ran it.
  const lettered = parsed.flatMap((part) => part.lettered.map((entry) => ({ ...entry, path: part.path })));
  if (lettered.length) {
    console.error(`roll-sacred: ${source} holds ${lettered.length} LETTERED item(s) this roll cannot number:`);
    for (const entry of lettered) {
      console.error(`  ${entry.path.split(/[\\/]/).pop()}:${entry.line}  ## ${entry.id}. ${entry.title}`);
    }
    console.error("  Promote each to a plain numbered item (and record the change in the part header) first.");
    process.exit(1);
  }
  const items = parsed.flatMap((part) => part.items);
  const seen = new Set();
  for (const item of items) {
    // Two parts claiming one number means the split drifted, and carrying it forward would mint a
    // duplicate id in the new month. Refuse rather than pick one.
    if (seen.has(item.number)) {
      console.error(`roll-sacred: item ${item.number} appears in more than one part of ${source}. Fix the split first.`);
      process.exit(1);
    }
    seen.add(item.number);
  }
  if (sourceParts.length > 1) {
    console.log(`  reading ${sourceParts.length} parts: ${sourceParts.map((p) => p.split(/[\\/]/).pop()).join(", ")}`);
  }
  const open = items.filter((item) => !isClosed(item));
  const lastNumber = items.reduce((max, item) => Math.max(max, item.number), 0);

  const mapRows = open.map((item, i) => ({ from: item.number, to: i + 1, title: item.title }));

  console.log(`roll-sacred: ${source} -> ${targetMonth}`);
  console.log(`  items in ${source}: ${items.length} (last number ${lastNumber})`);
  console.log(`  carrying forward: ${open.length}`);
  console.log(`  leaving closed in ${source}: ${items.length - open.length}`);
  if (dry) {
    mapRows.forEach((row) => console.log(`    ${source} item ${row.from}  ->  ${targetMonth} item ${row.to}`));
    console.log("  (dry run, nothing written)");
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  // ── FUTURE_PLANS ──
  const header = [
    `# Future plans — ${targetMonth}`,
    "",
    `> ## Carried forward from ${source}`,
    ">",
    `> **Item numbers restart at 1 in this file.** A number only means something together with its month, so write \`${targetMonth} item 3\`, never a bare \`item 3\`.`,
    ">",
    `> **${source} ended at item ${lastNumber}.** Its closed items stayed there; only open work came across.`,
    ">",
    "> | Was | Is now | Item |",
    "> |---|---|---|",
    ...mapRows.map((row) => `> | ${source} item ${row.from} | **${targetMonth} item ${row.to}** | ${row.title} |`),
    ">",
    `> Anything written before this roll that cites a bare item number means a ${source}-or-earlier number. See \`SACRED_FILES/README.md\` for the full registry.`,
    "",
    "---",
    "",
  ].join("\n");

  const carried = open
    .map((item, i) => item.text.replace(/^##\s+\d+\./, `## ${i + 1}.`))
    .join("\n\n");
  writeFileSync(join(targetDir, "FUTURE_PLANS.md"), `${header}${carried}\n`, "utf8");

  // ── WIP ──
  // Seeded empty on purpose: last month's weeks stay in last month's file until DEPLOY STATE says
  // they are history, and this script does not get to decide that.
  writeFileSync(
    join(targetDir, "WIP.md"),
    [
      `# WIP: weekly working log — ${targetMonth}`,
      "",
      `Continues from \`SACRED_FILES/${source}/WIP.md\`, which is sealed. Weeks are rotated out of a WIP by DEPLOY STATE, never by date: a week whose commits are not yet ancestors of \`origin/main\` (server) or \`origin/demo\` (client) is not history, however old it looks.`,
      "",
      "---",
      "",
      "## Week of MONTH D to D, YEAR  (publish Mon MONTH D)",
      "",
      "### Changes this week",
      "",
    ].join("\n"),
    "utf8",
  );

  // ── HISTORICAL ──
  writeFileSync(
    join(targetDir, "HISTORICAL.md"),
    [
      `# Historical: closed work — ${targetMonth}`,
      "",
      `Work that closed during ${targetMonth}. Earlier closed work stays in the month it closed in; \`SACRED_FILES/${source}/HISTORICAL.md\` is the previous one and \`SACRED_FILES/README.md\` holds the registry that resolves an old item number to its month.`,
      "",
    ].join("\n"),
    "utf8",
  );

  // ── ID registry ──
  const readmePath = join(SACRED, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const row = `| ${source} | 1 to ${lastNumber} | ${open.length} open items carried into ${targetMonth} and renumbered from 1; the map is in that file's header. |`;
  const marker = "\n\n---\n\n## Rotation inside a month";
  writeFileSync(
    readmePath,
    readme.includes(marker) ? readme.replace(marker, `\n${row}${marker}`) : `${readme}\n${row}\n`,
    "utf8",
  );

  console.log(`  wrote ${targetDir}`);
  console.log(`  appended the ${source} row to the ID registry`);
  console.log("  NOT touched: STATE.md, TECH_DEBT.md (living), and last month's WIP (deploy state decides).");
};

main();
