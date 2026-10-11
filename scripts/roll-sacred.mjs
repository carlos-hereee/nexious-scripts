#!/usr/bin/env node
// ── roll-sacred ──
// The monthly roll for SACRED_FILES. Run it on the first working session of a new month:
//
//   cd nexious-scripts && npm run roll:sacred            (roll into the current month)
//   npm run roll:sacred -- --month 2026-09               (roll into a named month)
//   npm run roll:sacred -- --dry                         (print the plan, write nothing)
//
// SACRED_ROOT overrides the folder that CONTAINS SACRED_FILES, so the roll can be rehearsed
// against a throwaway copy before it touches the real ledgers:
//
//   SACRED_ROOT=/tmp/sacred-rehearsal npm run roll:sacred -- --month 2026-10
//
// What it does, and why each part exists:
//   ① Creates SACRED_FILES/<new-month>/ with FUTURE_PLANS.md, WIP.md and HISTORICAL.md. The
//      FUTURE_PLANS is written in PARTS when the carry is too large for one readable file.
//   ② Carries the OPEN items forward from last month's FUTURE_PLANS, RENUMBERED FROM 1. Closed
//      items stay in the month they closed in, which is what keeps the new file light.
//   ③ Writes the carry-over header: source month, that month's last number, and the full
//      old-to-new map. This is the cookie trail, and it is the whole reason this is a script
//      rather than a checklist: a carried item that silently changes number turns every existing
//      reference to it into a lie, and nobody notices until they follow one.
//   ④ Appends a row to the ID registry in SACRED_FILES/README.md.
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

// SACRED_ROOT names the folder that CONTAINS SACRED_FILES, not SACRED_FILES itself. Without it the
// only way to rehearse a roll was to run it for real on the live ledgers, which is the one thing a
// script that renumbers stable ids should never make a person do to find out what it will write.
// The tooling package is nested under companyuno-library; the workspace is three levels up.
const ROOT = process.env.SACRED_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SACRED = join(ROOT, "SACRED_FILES");

// ── Layout budget ──
// BYTES, not item count, because rule 18's ceiling is about what a tool can read in one pass and
// the items vary from a few hundred bytes to twenty-odd KB. The README sets the trigger for adding
// a part at ~80KB and explains why: two parts that land AT the ceiling get pushed back over it
// within hours, so a split that only just clears is a deferral rather than a fix. 70KB is the aim,
// 80KB is the hard ceiling asserted after the files are built.
const PART_BUDGET_BYTES = 70 * 1024;
const PART_CEILING_BYTES = 80 * 1024;
// The per-part boundary table is a handful of short rows, but it is written AFTER the split it
// describes, so its exact size is not knowable while packing. Reserving for it is cheaper than a
// fixed-point loop, and being 300 bytes pessimistic per part costs nothing.
const BOUNDARY_TABLE_RESERVE = 700;

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

// ── Parts ──
// `FUTURE_PLANS.md` is part 1 and `FUTURE_PLANS-PART-<n>.md` is part n. The file name is the only
// authority on which part a file is; nothing infers it from content.
const PART_FILE = /^FUTURE_PLANS(?:-PART-(\d+))?\.md$/;
const partNumberOfFile = (name) => {
  const match = PART_FILE.exec(name);
  return match && match[1] ? Number(match[1]) : 1;
};
const fileNameForPart = (n) => (n === 1 ? "FUTURE_PLANS.md" : `FUTURE_PLANS-PART-${n}.md`);

/**
 * Every FUTURE_PLANS part in a month folder, in part order.
 *
 * DISCOVERED, never listed. This used to be `FUTURE_PLANS.md` plus a hardcoded `[2, 3, 4, 5]`, and
 * the failure mode of a hardcoded list is the exact one this script exists to prevent: the month a
 * sixth part appears, the roll reads five, reports a plausible item count, and silently leaves the
 * sixth part's open work behind in a month about to be sealed. A readdir cannot fall behind.
 */
const sourcePartFiles = (monthDir) =>
  readdirSync(monthDir)
    .filter((name) => PART_FILE.test(name))
    .sort((a, b) => partNumberOfFile(a) - partNumberOfFile(b));

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

/** The item's first nonblank line after its heading. */
const firstBodyLine = (text) => {
  for (const line of text.split("\n").slice(1)) if (line.trim()) return line.trim();
  return "";
};

/** The whole `**Status...` line, or "" when the item carries none. */
const statusLine = (text) => text.split("\n").find((line) => /\*\*Status[.:]/.test(line)) ?? "";

const CLOSED_STATUS_WORD = /^\*{0,2}(DONE|SHIPPED|MOOT|CLOSED|MOVED)\b/i;
// A status that still asserts the work is not out yet. Matched on the WHOLE status line rather than
// on its first 80 characters, and deliberately NOT stripped of `~~strikethrough~~` first: a status
// carrying both "SHIPPED" and any flavour of "NOT deployed" is a complicated status, and a
// complicated status is exactly the ambiguity this function is supposed to resolve by carrying.
const UNDEPLOYED_CLAIM = /\bNOT\s+(?:yet\s+)?(?:deployed|pushed|merged|released|live|on\b)|\buncommitted\b/i;
// A HISTORICAL stub: the item's body was moved out and a pointer left in its place.
const MOVED_STUB = /^Moved to `?SACRED_FILES\//i;

/**
 * Is this item CLOSED?
 *
 * Deliberately conservative: an item counts as closed only when its heading is struck through, its
 * body has been MOVED OUT to HISTORICAL, or its status line opens with a closed word and makes no
 * claim that the work is still undeployed. Anything ambiguous is carried FORWARD, because wrongly
 * carrying a closed item costs one line of clutter that a human deletes, while wrongly dropping an
 * open one loses tracked work silently. That asymmetry decides the default.
 *
 * Three things this has to get right, each learned from a real item in 2026-09:
 *
 * ① A MOVED stub has NO status line at all. Seven items (76, 86, 88, 91, 102, 110, 112) read
 *    "Moved to `SACRED_FILES/2026-09/HISTORICAL.md` ..." and nothing else, so a status-only test
 *    called every one of them open and the roll would have minted seven ghost items in the new
 *    month, each a duplicate of work already filed as closed one folder away.
 * ② Both `**Status.**` and `**Status:` are in use (87 items and 13 items respectively in 2026-09),
 *    and a lookup that only knew the first spelling could never see the second.
 * ③ Knowing the second spelling is what makes the undeployed guard necessary. Items 99, 107 and
 *    119 all open with "SHIPPED" and all three go on to say NOT deployed, NOT pushed, or NOT yet on
 *    the deploy branch. Under this project's law a week is history by DEPLOY STATE and never by
 *    what a heading claims, so closing those three on the word "SHIPPED" would drop live work.
 */
const isClosed = (item) => {
  if (/^~~.*~~/.test(item.title.trim())) return true;
  if (MOVED_STUB.test(firstBodyLine(item.text))) return true;
  const line = statusLine(item.text);
  if (!line) return false;
  if (UNDEPLOYED_CLAIM.test(line)) return false;
  const status = /\*\*Status[.:]\*{0,2}\s*(.{0,80})/.exec(line);
  return Boolean(status && CLOSED_STATUS_WORD.test(status[1].trim()));
};

const pad = (n) => String(n).padStart(2, "0");
const prevMonthOf = (month) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
};
const bytes = (text) => Buffer.byteLength(text, "utf8");

/**
 * Pack the carried bodies into parts by BYTES, cutting on item boundaries only.
 *
 * Greedy and therefore contiguous, which is the point: a part is an ITEM RANGE, never a theme. A
 * themed split makes filing a new item a judgement call and judgement calls drift, while "items 25
 * to 48" is mechanical. Part 1 gets a smaller item budget because it also carries the whole
 * carry-forward map, which is the mistake the first 2026-08 split made by balancing on item count.
 */
const packParts = (bodies, firstPartOverhead, laterPartOverhead) => {
  const parts = [];
  let current = [];
  let used = 0;
  let budget = PART_BUDGET_BYTES - firstPartOverhead;
  for (const body of bodies) {
    const cost = bytes(body) + (current.length ? 2 : 0); // the blank line between two items
    // An item larger than a whole budget still gets its own part rather than being split: an item
    // is the atom here, and cutting one in half would break the heading-to-body relationship every
    // other tool in this repo relies on.
    if (current.length && used + cost > budget) {
      parts.push(current);
      current = [];
      used = 0;
      budget = PART_BUDGET_BYTES - laterPartOverhead;
    }
    current.push(body);
    used += current.length === 1 ? bytes(body) : cost;
  }
  if (current.length) parts.push(current);
  return parts;
};

/** The "which part is an item in" table, repeated in every part so no part is a dead end. */
const boundaryTable = (ranges) =>
  [
    "## Which part is an item in?",
    "",
    "| Part | Items | File |",
    "|---|---|---|",
    ...ranges.map(
      (range, i) => `| ${i + 1} | ${range.from} to ${range.to} | \`${fileNameForPart(i + 1)}\` |`,
    ),
  ].join("\n");

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

  // A month's FUTURE_PLANS may be SPLIT ACROSS PARTS, and how many parts is not knowable in
  // advance: 2026-08 was split three ways and 2026-09 grew to six. Reading a fixed list would carry
  // the low-numbered part forward and SILENTLY DROP the rest, which is the kind of loss this script
  // exists to prevent. Parts are discovered, read in order and concatenated, so item order and
  // numbering are exactly what a single file would have produced.
  const sourceDir = join(SACRED, source);
  const sourceParts = sourcePartFiles(sourceDir).map((name) => join(sourceDir, name));
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

  // ── Lay the carry out across parts ──
  // Done before the dry-run return so `--dry` reports the file layout it would write, which is the
  // half of the plan a person most wants to see before letting it run for real.
  const carriedBodies = open.map((item, i) => item.text.replace(/^##\s+\d+\./, `## ${i + 1}.`));

  const mapBlock = [
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
  ].join("\n");

  const titleLine = `# Future plans — ${targetMonth}`;
  const laterPartNote = (n, from, to) =>
    `> **This is part ${n} of ${targetMonth}'s FUTURE_PLANS, and a PART IS NOT A FORK.** It holds items ${from} to ${to} and duplicates nothing. The old-to-new carry-forward map covering every item in every part lives in part 1's header, \`FUTURE_PLANS.md\`, and nowhere else.`;

  // Overheads are what each part spends on header text before a single item body lands in it.
  const firstPartOverhead = bytes(`${titleLine}\n\n${mapBlock}\n\n`) + BOUNDARY_TABLE_RESERVE + 16;
  const laterPartOverhead = bytes(`${titleLine} (part 9)\n\n${laterPartNote(9, 999, 999)}\n\n`) + BOUNDARY_TABLE_RESERVE + 16;

  const packed = packParts(carriedBodies, firstPartOverhead, laterPartOverhead);
  const ranges = [];
  let cursor = 1;
  for (const part of packed) {
    ranges.push({ from: cursor, to: cursor + part.length - 1 });
    cursor += part.length;
  }
  const table = boundaryTable(ranges);

  const partFiles = packed.map((part, i) => {
    const n = i + 1;
    const head =
      n === 1
        ? [titleLine, "", mapBlock, "", table, "", "---", "", ""].join("\n")
        : [
            `${titleLine} (part ${n})`,
            "",
            laterPartNote(n, ranges[i].from, ranges[i].to),
            "",
            table,
            "",
            "---",
            "",
            "",
          ].join("\n");
    return { name: fileNameForPart(n), content: `${head}${part.join("\n\n")}\n`, range: ranges[i] };
  });

  console.log(`  writing ${partFiles.length} FUTURE_PLANS part(s):`);
  for (const file of partFiles) {
    console.log(
      `    ${file.name.padEnd(24)} items ${String(file.range.from).padStart(3)} to ${String(file.range.to).padStart(3)}  ${(bytes(file.content) / 1024).toFixed(1)} KB`,
    );
  }

  if (dry) {
    mapRows.forEach((row) => console.log(`    ${source} item ${row.from}  ->  ${targetMonth} item ${row.to}`));
    console.log("  (dry run, nothing written)");
    return;
  }

  // A part over the ceiling is the failure the split exists to prevent, so it is asserted on the
  // BUILT bytes rather than trusted from the packing arithmetic.
  const oversized = partFiles.filter((file) => bytes(file.content) > PART_CEILING_BYTES);
  if (oversized.length) {
    console.error(`roll-sacred: ${oversized.length} part(s) came out over the ${PART_CEILING_BYTES / 1024}KB ceiling:`);
    for (const file of oversized) console.error(`  ${file.name}  ${(bytes(file.content) / 1024).toFixed(1)} KB`);
    console.error("  Lower PART_BUDGET_BYTES, or split the oversized item's body out to roadmaps/ first.");
    process.exit(1);
  }

  mkdirSync(targetDir, { recursive: true });

  // ── FUTURE_PLANS ──
  for (const file of partFiles) writeFileSync(join(targetDir, file.name), file.content, "utf8");

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
  // Anchored to an explicit `<!-- ID-REGISTRY-END -->` comment sitting under the table's last row.
  // The old anchor was the "## Rotation inside a month" heading that happens to follow the table,
  // which made the insert point a fact about an unrelated section: retitle or reorder that section
  // and the roll appends the row to the very end of the README, outside the table, where it renders
  // as a stray line of pipes and answers "where did item 93 go" for nobody. The heading lookup is
  // kept as a loud fallback so an older README still rolls.
  const readmePath = join(SACRED, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const row = `| ${source} | 1 to ${lastNumber} | ${open.length} open items carried into ${targetMonth} and renumbered from 1; the map is in that file's header. |`;
  const registryEnd = "<!-- ID-REGISTRY-END -->";
  const headingMarker = "\n\n---\n\n## Rotation inside a month";
  let updatedReadme;
  if (readme.includes(registryEnd)) {
    updatedReadme = readme.replace(registryEnd, `${row}\n${registryEnd}`);
  } else if (readme.includes(headingMarker)) {
    console.warn(
      `  WARNING: ${registryEnd} is missing from SACRED_FILES/README.md; fell back to the "## Rotation inside a month" heading.`,
    );
    console.warn("  Add the marker under the ID registry table's last row so the next roll does not depend on a heading.");
    updatedReadme = readme.replace(headingMarker, `\n${row}${headingMarker}`);
  } else {
    console.warn(`  WARNING: neither ${registryEnd} nor the rotation heading was found; appended the registry row to the end of the README.`);
    updatedReadme = `${readme}\n${row}\n`;
  }
  writeFileSync(readmePath, updatedReadme, "utf8");

  console.log(`  wrote ${targetDir}`);
  console.log(`  appended the ${source} row to the ID registry`);
  console.log("  NOT touched: STATE.md, TECH_DEBT.md (living), and last month's WIP (deploy state decides).");
};

main();
