// Tests for the random string generator. These are intentionally simple: they pin the
// *shape* and *character set* of the output, not a specific string (obviously, the
// output is random). If a refactor changes segmentation, dash rules, or the alphabet,
// these tests catch it before the ports drift out of sync.
//
// Run with: npm run test (once a test runner is wired in). Using Node's built-in
// assert + a tiny harness keeps this file dependency-free for now.

import assert from "node:assert/strict";
import { generateRandomString, generateRandomList } from "./generate.js";
import { POOL_FULL, POOL_SAFE, POOL_HEX, SEGMENT_LENGTH, DASH_THRESHOLD } from "./charPools.js";

const tests: { name: string; fn: () => void }[] = [];
const test = (name: string, fn: () => void) => tests.push({ name, fn });

test("default length is 24 and produces 4 dash-joined segments of 6", () => {
  const s = generateRandomString();
  // 24 chars + 3 dashes = 27 total.
  assert.equal(s.length, 27, `expected 27 chars including dashes, got ${s.length}: ${s}`);
  const parts = s.split("-");
  assert.equal(parts.length, 4);
  for (const p of parts) assert.equal(p.length, SEGMENT_LENGTH);
});

test("length below or at DASH_THRESHOLD returns a raw string", () => {
  const s = generateRandomString({ length: DASH_THRESHOLD });
  assert.equal(s.length, DASH_THRESHOLD);
  assert.ok(!s.includes("-"), `expected no dashes, got ${s}`);
});

test("noDashes suppresses dashes regardless of length", () => {
  const s = generateRandomString({ length: 24, noDashes: true });
  assert.equal(s.length, 24);
  assert.ok(!s.includes("-"));
});

test("alphabet=safe only uses alphanumeric", () => {
  const s = generateRandomString({ length: 100, alphabet: "safe", noDashes: true });
  for (const c of s) {
    assert.ok(POOL_SAFE.includes(c), `safe alphabet leaked ${c}`);
  }
});

test("alphabet=hex only uses 0-9a-f", () => {
  const s = generateRandomString({ length: 64, alphabet: "hex", noDashes: true });
  assert.match(s, /^[0-9a-f]+$/);
  assert.equal(s.length, 64);
});

test("alphabet=full stays within POOL_FULL", () => {
  const s = generateRandomString({ length: 200, alphabet: "full", noDashes: true });
  for (const c of s) {
    assert.ok(POOL_FULL.includes(c), `full alphabet leaked ${c}`);
  }
});

test("two successive calls produce different strings (sanity)", () => {
  // Non-deterministic test, but 24-char collisions are ~zero probability. If this
  // fails something is very wrong with the RNG wiring.
  const a = generateRandomString();
  const b = generateRandomString();
  assert.notEqual(a, b);
});

test("generateRandomList returns N objects with distinct ids", () => {
  const list = generateRandomList(10);
  assert.equal(list.length, 10);
  const ids = new Set(list.map((x) => x.id));
  assert.equal(ids.size, 10);
});

// Tiny runner. Prints pass/fail lines so the output is readable with plain `node` until
// a real test runner is added.
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
