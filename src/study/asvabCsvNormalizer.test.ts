// Tests for the ASVAB CSV normalizer. They pin the transform against the
// importer's contract (nexious-client csvToItems.ts) rather than against the
// source files: both header variants, the answer stripped from choices or the
// row reported when it is not there, the empty why HARD GATE, and a filename
// whose kind is not one of the three. Same dependency free harness as
// random/generate.test.ts.

import assert from "node:assert/strict";
import {
  CANONICAL_HEADER,
  identityFromFileName,
  normalizeFile,
  parseCsv,
  renderReport,
  serializeCsv,
  stripAnswerFromChoices,
  summarize,
} from "./asvabCsvNormalizer.js";

const tests: { name: string; fn: () => void }[] = [];
const test = (name: string, fn: () => void) => tests.push({ name, fn });

const PROMPT_HEADER = "type,prompt,answer,choices,why,difficulty";
const QUESTION_HEADER = "type,question,correct_answer,choices,why,difficulty";
const row = (prompt: string, answer: string, choices: string, why: string, difficulty = "Unranked") =>
  `"Worked example","${prompt}","${answer}","${choices}","${why}","${difficulty}"`;

test("filename identity: the three kinds parse, anything else is null", () => {
  assert.deepEqual(identityFromFileName("lesson-1-quiz.csv"), { lesson: 1, kind: "quiz" });
  assert.deepEqual(identityFromFileName("lesson-31-verification.csv"), { lesson: 31, kind: "verification" });
  assert.deepEqual(identityFromFileName("lesson-7-practice.csv"), { lesson: 7, kind: "practice" });
  assert.equal(identityFromFileName("lesson-7-review.csv"), null);
  assert.equal(identityFromFileName("lesson-7.csv"), null);
  assert.equal(identityFromFileName("notes.txt"), null);
});

test("the prompt,answer header variant writes the canonical header and stamps the role", () => {
  const text = [PROMPT_HEADER, row("Evaluate: 5 + 2 × 3", "11", "21 | 11 | 17 | 13", "Multiply first.")].join("\n");
  const result = normalizeFile("lesson-1-practice.csv", text);
  assert.equal(result.fileError, null);
  assert.equal(result.headerVariant, "prompt,answer");
  assert.equal(result.rowsIn, 1);
  assert.equal(result.rowsOut, 1);
  const parsed = parseCsv(result.output);
  assert.deepEqual(parsed[0], Array.from(CANONICAL_HEADER));
  assert.deepEqual(parsed[1], ["card", "Evaluate: 5 + 2 × 3", "11", "21|17|13", "Multiply first.", "", "practice"]);
  assert.ok(result.output.endsWith("\n"), "output ends with a trailing newline");
});

test("the question,correct_answer header variant is aliased on read and written canonically", () => {
  const text = [QUESTION_HEADER, row("What does x > 5 mean?", "x is greater than 5", "x equals 5 | x is greater than 5", "Right!", "easy")].join("\n");
  const result = normalizeFile("lesson-10-quiz.csv", text);
  assert.equal(result.fileError, null);
  assert.equal(result.headerVariant, "question,correct_answer");
  const parsed = parseCsv(result.output);
  assert.deepEqual(parsed[0], Array.from(CANONICAL_HEADER));
  assert.deepEqual(parsed[1], ["card", "What does x > 5 mean?", "x is greater than 5", "x equals 5", "Right!", "easy", "quiz"]);
});

test("a header with neither prompt nor question refuses the whole file", () => {
  const text = ["type,text,answer,choices,why,difficulty", row("p", "a", "a | b", "w")].join("\n");
  const result = normalizeFile("lesson-2-verification.csv", text);
  assert.match(result.fileError ?? "", /missing required column: prompt/);
  assert.equal(result.rowsOut, 0);
  assert.equal(result.output, "");
});

test("the answer is removed from choices case insensitively and trimmed", () => {
  assert.deepEqual(stripAnswerFromChoices("Subtract 5 − 2", "Multiply 6 × 5 | subtract 5 − 2  | Add 2 + 8"), {
    choices: "Multiply 6 × 5|Add 2 + 8",
    matched: true,
  });
});

test("an answer absent from choices keeps the cell as is and reports the row", () => {
  const text = [PROMPT_HEADER, row("Pick one", "3/4", "1/2 | 2/3 | 5/6", "Because.")].join("\n");
  const result = normalizeFile("lesson-3-practice.csv", text);
  assert.equal(result.rowsOut, 1);
  assert.equal(result.answerMisses.length, 1);
  assert.equal(result.answerMisses[0]?.line, 2);
  assert.equal(result.answerMisses[0]?.answer, "3/4");
  const parsed = parseCsv(result.output);
  assert.equal(parsed[1]?.[3], "1/2|2/3|5/6");
});

test("an empty why drops the row, records it, and fails the run (the hard gate)", () => {
  const text = [PROMPT_HEADER, row("Evaluate: 5 + 2 × 3", "11", "21 | 11", ""), row("Evaluate: 1 + 1", "2", "3 | 2", "Add.")].join("\n");
  const result = normalizeFile("lesson-1-quiz.csv", text);
  assert.equal(result.rowsIn, 2);
  assert.equal(result.rowsOut, 1);
  assert.deepEqual(result.dropped, [{ line: 2, prompt: "Evaluate: 5 + 2 × 3", reason: "emptyWhy" }]);
  const summary = summarize([result]);
  assert.equal(summary.blockedRows, 1);
  assert.equal(summary.blockedFiles, 1);
  assert.equal(summary.failed, true);
  assert.equal(summary.byRole.quiz.rowsIn, 2);
  assert.equal(summary.byRole.quiz.rowsOut, 1);
  const report = renderReport(summary, { inputDir: "in", outputDir: "out", generatedAt: "now" });
  assert.match(report, /RESULT: BLOCKED/);
  assert.match(report, /lesson-1-quiz\.csv \(lesson 1, quiz\)/);
  assert.match(report, /line 2: empty why/);
});

test("a file whose every why is empty writes nothing rather than an importable-looking empty file", () => {
  const text = [PROMPT_HEADER, row("a", "1", "1 | 2", ""), row("b", "2", "2 | 3", "")].join("\n");
  const result = normalizeFile("lesson-4-quiz.csv", text);
  assert.equal(result.rowsOut, 0);
  assert.equal(result.output, "");
});

test("an unrecognised file kind is a file error and stamps no role", () => {
  const text = [PROMPT_HEADER, row("a", "1", "1 | 2", "why")].join("\n");
  const result = normalizeFile("lesson-4-review.csv", text);
  assert.match(result.fileError ?? "", /unrecognised file name/);
  assert.equal(result.identity, null);
  assert.equal(result.rowsOut, 0);
  const summary = summarize([result]);
  assert.equal(summary.fileErrors, 1);
  assert.equal(summary.failed, true);
});

test("difficulty keeps easy, medium and hard and blanks anything else", () => {
  const text = [
    PROMPT_HEADER,
    row("a", "1", "1 | 2", "w", "Hard"),
    row("b", "1", "1 | 2", "w", "Unranked"),
    row("c", "1", "1 | 2", "w", "medium"),
  ].join("\n");
  const parsed = parseCsv(normalizeFile("lesson-5-practice.csv", text).output);
  assert.deepEqual(parsed.slice(1).map((line) => line[5]), ["hard", "", "medium"]);
});

test("a clean run reports CLEAN and does not fail", () => {
  const text = [PROMPT_HEADER, row("a", "1", "1 | 2", "w")].join("\n");
  const summary = summarize([normalizeFile("lesson-6-verification.csv", text)]);
  assert.equal(summary.failed, false);
  assert.match(renderReport(summary, { inputDir: "in", outputDir: "out", generatedAt: "now" }), /RESULT: CLEAN/);
});

test("serializeCsv round trips quotes, commas and newlines through parseCsv", () => {
  const rows = [["a,b", 'say "hi"', "line1\nline2"]];
  assert.deepEqual(parseCsv(serializeCsv(rows)), rows);
});

let pass = 0;
let fail = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`ok  ${name}`);
    pass++;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    fail++;
  }
}
console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
