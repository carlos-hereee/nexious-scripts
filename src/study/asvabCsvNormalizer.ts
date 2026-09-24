// ── asvabCsvNormalizer ──
// Turns the raw ASVAB math CSVs (one file per lesson per kind, named
// `lesson-{n}-{kind}.csv`) into files that Study Lab's per lesson importer will
// actually accept. The importer's contract lives in
// `nexious-client/src/features/plugin-modules/study/csvToItems.ts` and it does
// NOT move: every transform happens here, because the data is what is wrong.
//
// What the source gets wrong, each verified against the importer on 2026-09-23:
//   ① 66 of 93 files head `type,question,correct_answer,...`; `prompt` is the
//      one required column, so the whole file imports ZERO rows.
//   ② no `role` column anywhere, so every row would land as `practice` and the
//      quiz / verification / practice split the filenames encode would be lost.
//   ③ the `choices` cell already CONTAINS the correct answer, and the importer
//      prepends the answer to whatever is in that cell, so every question would
//      render five options with the right one listed twice.
//   ④ quiz rows carry an empty `why`, and `type` "Worked example" maps to
//      `card` (only the literal "worked" maps to worked), which has no hint
//      steps to synthesize a why from, so the importer skips the row.
//   ⑤ no trailing newline on 66 files (cosmetic: the importer flushes the last
//      row anyway, but the output says what it means).
//
// The why gap (④) is a HARD GATE. This module never invents an explanation and
// never passes a row through that the importer would skip: such a row goes to
// the report and the caller exits nonzero. An explanation the platform made up
// would be shipped to a learner as if an author wrote it.

// The importer's caps, mirrored from
// `nexious-client/src/features/plugin-modules/study/studyConstants.ts`. They
// are ASSERTED here rather than chunked around: every source file is a small
// fraction of each, so tripping one is a signal that the source changed shape,
// not something to paper over.
export const MAX_IMPORT_FILE_BYTES = 1_000_000;
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_PAYLOAD_BYTES = 90_000;

// The one dialect the importer reads, in the column order the client's own
// example file uses. Written verbatim on every output file whatever the input
// headed.
export const CANONICAL_HEADER = ["type", "prompt", "answer", "choices", "why", "difficulty", "role"] as const;

// Read-side aliases: the source's spelling on the left, the importer's on the
// right. Applied to the lowercased header only; a file that already uses the
// canonical name is untouched.
const HEADER_ALIASES: Record<string, string> = {
  question: "prompt",
  correct_answer: "answer",
};

// The three kinds the filenames encode, each the importer's role of the same
// name. Parsed from the NAME, never guessed from content.
export const FILE_KINDS = ["quiz", "verification", "practice"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

const FILE_NAME = /^lesson-(\d+)-(quiz|verification|practice)\.csv$/i;

export interface FileIdentity {
  lesson: number;
  kind: FileKind;
}

export const identityFromFileName = (fileName: string): FileIdentity | null => {
  const match = FILE_NAME.exec(fileName);
  if (!match) return null;
  return { lesson: Number(match[1]), kind: match[2]!.toLowerCase() as FileKind };
};

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

// Minimal RFC4180 reader, the same shape as the client's parseCsv: quoted
// fields, "" as an escaped quote, commas and newlines inside quotes, blank rows
// dropped. Kept as a twin rather than imported because this package does not
// depend on the client and never will.
export function parseCsv(input: string): string[][] {
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const next = text.charAt(i + 1);

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Every cell quoted, every quote doubled, LF line endings, and a trailing
// newline (⑤). Quoting unconditionally is what keeps a why with a comma or an
// embedded newline intact on the way back through the importer's reader.
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
}

export type HeaderVariant = "prompt,answer" | "question,correct_answer" | "unknown";

export interface DroppedRow {
  // The CSV line number, header being line 1, so it matches the importer's own
  // "Row N" wording and the owner can find it in the source file.
  line: number;
  prompt: string;
  reason: "emptyPrompt" | "emptyWhy";
}

export interface AnswerMiss {
  line: number;
  prompt: string;
  answer: string;
  choices: string;
}

export interface NormalizedFile {
  fileName: string;
  identity: FileIdentity | null;
  headerVariant: HeaderVariant;
  // Whole-file refusals: an unrecognised name, or no prompt column even after
  // aliasing. When set, `rows` is empty and nothing is written for this file.
  fileError: string | null;
  rowsIn: number;
  rowsOut: number;
  rows: string[][];
  dropped: DroppedRow[];
  answerMisses: AnswerMiss[];
  // The serialized output, so the caller writes exactly what was measured
  // against the caps.
  output: string;
  capViolations: string[];
}

const normalizeChoice = (value: string): string => value.trim().toLowerCase();

// Removes the correct answer from the choices cell (③). When no choice matches
// the cell is kept AS IS and the row is reported, because silently dropping a
// distractor would hide a data problem behind a plausible looking file.
export const stripAnswerFromChoices = (answer: string, choicesRaw: string): { choices: string; matched: boolean } => {
  const parts = choicesRaw
    .split("|")
    .map((choice) => choice.trim())
    .filter((choice) => choice.length > 0);
  const key = normalizeChoice(answer);
  const kept = parts.filter((choice) => normalizeChoice(choice) !== key);
  const matched = kept.length !== parts.length;
  return { choices: (matched ? kept : parts).join("|"), matched };
};

const headerVariantOf = (lowered: readonly string[]): HeaderVariant => {
  if (lowered.includes("prompt") && lowered.includes("answer")) return "prompt,answer";
  if (lowered.includes("question") && lowered.includes("correct_answer")) return "question,correct_answer";
  return "unknown";
};

// One file in, one normalized file out. Pure: no filesystem, so the test feeds
// it strings and the CLI owns the reads and writes.
export function normalizeFile(fileName: string, text: string): NormalizedFile {
  const identity = identityFromFileName(fileName);
  const base: NormalizedFile = {
    fileName,
    identity,
    headerVariant: "unknown",
    fileError: null,
    rowsIn: 0,
    rowsOut: 0,
    rows: [],
    dropped: [],
    answerMisses: [],
    output: "",
    capViolations: [],
  };

  if (!identity) {
    return { ...base, fileError: `unrecognised file name (expected lesson-{n}-{quiz|verification|practice}.csv)` };
  }

  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { ...base, fileError: "need a header row plus at least one data row" };
  }

  const rawHeader = (parsed[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const headerVariant = headerVariantOf(rawHeader);
  const header = rawHeader.map((name) => HEADER_ALIASES[name] ?? name);
  const idxOf = (name: string): number => header.indexOf(name);
  const promptIdx = idxOf("prompt");
  if (promptIdx === -1) {
    return { ...base, headerVariant, fileError: "missing required column: prompt (no question alias either)" };
  }
  const answerIdx = idxOf("answer");
  const choicesIdx = idxOf("choices");
  const whyIdx = idxOf("why");
  const difficultyIdx = idxOf("difficulty");

  const rows: string[][] = [];
  const dropped: DroppedRow[] = [];
  const answerMisses: AnswerMiss[] = [];
  const dataRows = parsed.slice(1);

  dataRows.forEach((row, index) => {
    const line = index + 2;
    const cell = (idx: number): string => (idx < 0 || idx >= row.length ? "" : (row[idx] ?? "").trim());

    const prompt = cell(promptIdx);
    if (!prompt) {
      dropped.push({ line, prompt: "", reason: "emptyPrompt" });
      return;
    }

    const answer = cell(answerIdx);
    const why = cell(whyIdx);
    // ④ The gate. No hints column exists in this data and the row is written
    // as a card, so there is nothing downstream to synthesize a why from.
    if (!why) {
      dropped.push({ line, prompt, reason: "emptyWhy" });
      return;
    }

    const choicesRaw = cell(choicesIdx);
    let choices = choicesRaw;
    if (choicesRaw && answer) {
      const stripped = stripAnswerFromChoices(answer, choicesRaw);
      choices = stripped.choices;
      if (!stripped.matched) answerMisses.push({ line, prompt, answer, choices: choicesRaw });
    }

    const difficultyRaw = cell(difficultyIdx).toLowerCase();
    // "Unranked" and anything else unknown is written EMPTY rather than passed
    // through for the importer to discard silently.
    const difficulty = DIFFICULTIES.has(difficultyRaw) ? difficultyRaw : "";

    // `card`, never `worked`: a worked row with no hint steps loses its why
    // synthesis path entirely, and this data has no hints column.
    rows.push(["card", prompt, answer, choices, why, difficulty, identity.kind]);
  });

  const output = rows.length > 0 ? serializeCsv([Array.from(CANONICAL_HEADER), ...rows]) : "";

  const capViolations: string[] = [];
  const outputBytes = Buffer.byteLength(output, "utf8");
  if (outputBytes > MAX_IMPORT_FILE_BYTES) capViolations.push(`output is ${outputBytes} bytes, over MAX_IMPORT_FILE_BYTES ${MAX_IMPORT_FILE_BYTES}`);
  if (rows.length > MAX_IMPORT_ROWS) capViolations.push(`${rows.length} rows, over MAX_IMPORT_ROWS ${MAX_IMPORT_ROWS}`);
  // What the importer would put on the wire for this file in ONE request,
  // measured the way it measures (UTF-8 bytes of the JSON). It chunks past this
  // in reality; the assertion is that no source file here ever needs it to.
  const payload = rows.map(([type, prompt, answer, choices, why, difficulty, role]) => ({
    type,
    prompt,
    answer,
    why,
    section: "",
    category: "",
    difficulty,
    role,
    hints: [],
    options: choices ? [{ text: answer, isCorrect: true }, ...choices.split("|").map((text) => ({ text, isCorrect: false }))] : [],
    lessonUid: "000000000000000000000000",
  }));
  const payloadBytes = Buffer.byteLength(JSON.stringify({ items: payload }), "utf8");
  if (payloadBytes > MAX_IMPORT_PAYLOAD_BYTES) capViolations.push(`payload is ${payloadBytes} bytes, over MAX_IMPORT_PAYLOAD_BYTES ${MAX_IMPORT_PAYLOAD_BYTES}`);

  return {
    ...base,
    headerVariant,
    rowsIn: dataRows.length,
    rowsOut: rows.length,
    rows,
    dropped,
    answerMisses,
    output,
    capViolations,
  };
}

export interface RunSummary {
  files: NormalizedFile[];
  rowsIn: number;
  rowsOut: number;
  byRole: Record<FileKind, { rowsIn: number; rowsOut: number }>;
  blockedRows: number;
  blockedFiles: number;
  fileErrors: number;
  answerMisses: number;
  capViolations: number;
  // Nonzero exit when set: something the owner must read before importing.
  failed: boolean;
}

export function summarize(files: NormalizedFile[]): RunSummary {
  const byRole: RunSummary["byRole"] = {
    quiz: { rowsIn: 0, rowsOut: 0 },
    verification: { rowsIn: 0, rowsOut: 0 },
    practice: { rowsIn: 0, rowsOut: 0 },
  };
  let rowsIn = 0;
  let rowsOut = 0;
  let blockedRows = 0;
  let blockedFiles = 0;
  let fileErrors = 0;
  let answerMisses = 0;
  let capViolations = 0;
  for (const file of files) {
    rowsIn += file.rowsIn;
    rowsOut += file.rowsOut;
    if (file.identity) {
      byRole[file.identity.kind].rowsIn += file.rowsIn;
      byRole[file.identity.kind].rowsOut += file.rowsOut;
    }
    const whyBlocked = file.dropped.filter((row) => row.reason === "emptyWhy").length;
    blockedRows += whyBlocked;
    if (whyBlocked > 0) blockedFiles += 1;
    if (file.fileError) fileErrors += 1;
    answerMisses += file.answerMisses.length;
    capViolations += file.capViolations.length;
  }
  return {
    files,
    rowsIn,
    rowsOut,
    byRole,
    blockedRows,
    blockedFiles,
    fileErrors,
    answerMisses,
    capViolations,
    failed: blockedRows > 0 || fileErrors > 0 || capViolations > 0,
  };
}

const sortFiles = (files: readonly NormalizedFile[]): NormalizedFile[] =>
  [...files].sort((a, b) => {
    const la = a.identity?.lesson ?? Number.MAX_SAFE_INTEGER;
    const lb = b.identity?.lesson ?? Number.MAX_SAFE_INTEGER;
    if (la !== lb) return la - lb;
    const ka = a.identity ? FILE_KINDS.indexOf(a.identity.kind) : 99;
    const kb = b.identity ? FILE_KINDS.indexOf(b.identity.kind) : 99;
    return ka - kb || a.fileName.localeCompare(b.fileName);
  });

const reasonText: Record<DroppedRow["reason"], string> = {
  emptyPrompt: "empty prompt",
  emptyWhy: "empty why and no hint steps to build one from (the importer would skip it)",
};

// The artifact the owner reads to decide whether the batch is safe to import.
// Everything in it is a count or a row reference; nothing here is authored.
export function renderReport(summary: RunSummary, options: { inputDir: string; outputDir: string; generatedAt: string }): string {
  const files = sortFiles(summary.files);
  const lines: string[] = [];
  lines.push("# ASVAB CSV normalizer report");
  lines.push("");
  lines.push(`Generated ${options.generatedAt}. Source \`${options.inputDir}\`, output \`${options.outputDir}\`.`);
  lines.push("");
  lines.push(summary.failed ? "**RESULT: BLOCKED.** Read the sections below before importing anything." : "**RESULT: CLEAN.** Every row in is a row out.");
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| Role | Rows in | Rows out |");
  lines.push("|---|---|---|");
  for (const kind of FILE_KINDS) lines.push(`| ${kind} | ${summary.byRole[kind].rowsIn} | ${summary.byRole[kind].rowsOut} |`);
  lines.push(`| **all** | **${summary.rowsIn}** | **${summary.rowsOut}** |`);
  lines.push("");
  lines.push(`Files: ${files.length}. File errors: ${summary.fileErrors}. Rows blocked on an empty why: ${summary.blockedRows} in ${summary.blockedFiles} file(s). Answer not found among choices: ${summary.answerMisses}. Cap violations: ${summary.capViolations}.`);
  lines.push("");
  lines.push("## Per file");
  lines.push("");
  lines.push("| File | Header variant | Role | Rows in | Rows out | Dropped | Answer misses | Written |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const file of files) {
    const written = file.fileError ? "no (file error)" : file.rowsOut > 0 ? "yes" : "no (zero rows)";
    lines.push(
      `| ${file.fileName} | ${file.headerVariant} | ${file.identity?.kind ?? ""} | ${file.rowsIn} | ${file.rowsOut} | ${file.dropped.length} | ${file.answerMisses.length} | ${written} |`
    );
  }
  lines.push("");

  const errored = files.filter((file) => file.fileError);
  if (errored.length > 0) {
    lines.push("## File errors");
    lines.push("");
    for (const file of errored) lines.push(`- \`${file.fileName}\`: ${file.fileError}`);
    lines.push("");
  }

  const withDrops = files.filter((file) => file.dropped.length > 0);
  if (withDrops.length > 0) {
    lines.push("## Rows dropped");
    lines.push("");
    lines.push("Line numbers count the header as line 1, matching the importer's own row numbering.");
    lines.push("");
    for (const file of withDrops) {
      lines.push(`### ${file.fileName} (lesson ${file.identity?.lesson ?? "?"}, ${file.identity?.kind ?? "?"})`);
      lines.push("");
      for (const row of file.dropped) lines.push(`- line ${row.line}: ${reasonText[row.reason]}${row.prompt ? ` · ${row.prompt}` : ""}`);
      lines.push("");
    }
  }

  const withMisses = files.filter((file) => file.answerMisses.length > 0);
  if (withMisses.length > 0) {
    lines.push("## Answer not found among choices (cell kept as is)");
    lines.push("");
    lines.push("The importer prepends the answer as the correct option, so these rows will show the answer PLUS every listed choice. Check whether the answer is spelled differently in the choices cell.");
    lines.push("");
    for (const file of withMisses) {
      lines.push(`### ${file.fileName}`);
      lines.push("");
      for (const miss of file.answerMisses) lines.push(`- line ${miss.line}: answer \`${miss.answer}\` · choices \`${miss.choices}\` · ${miss.prompt}`);
      lines.push("");
    }
  }

  const withCaps = files.filter((file) => file.capViolations.length > 0);
  if (withCaps.length > 0) {
    lines.push("## Cap violations");
    lines.push("");
    for (const file of withCaps) for (const violation of file.capViolations) lines.push(`- \`${file.fileName}\`: ${violation}`);
    lines.push("");
  }

  return lines.join("\n");
}
