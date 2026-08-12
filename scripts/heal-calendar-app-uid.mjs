#!/usr/bin/env node
// ── heal-calendar-app-uid ──
// Repairs calendars whose `appUid` no longer matches the `uid` of the App that references
// them, which makes the calendar invisible to every appUid-keyed lookup on the server.
//
//   cd nexious-scripts
//   npm run heal:calendar-app-uid                                   DRY RUN (default)
//   npm run heal:calendar-app-uid -- --uri "<prod-uri>" --db test   DRY RUN against prod
//   npm run heal:calendar-app-uid -- --uri "<prod-uri>" --db test --write   actually writes
//
// ⚠️ DRY RUN IS THE DEFAULT AND --write IS THE ONLY WAY TO CHANGE ANYTHING. Run it dry first,
// read the table, then run it again with --write. It is idempotent: a second --write run finds
// zero drifted rows and does nothing.
//
// WHAT WENT WRONG, because the repair only makes sense once you see it.
// A calendar is linked to its app TWICE: `Calendar.appUid` holds the app's `uid`, and
// `App.calendar` holds the calendar's `_id`. `backfill-app-uid.js` (this same folder) assigns a
// FRESH v4 uid to any App missing one, and it updates `db.apps` alone. Any app it touched that
// already had a calendar came out with a working `App.calendar` ref and a `Calendar.appUid`
// still holding the OLD value (or none). The ref-keyed readers kept working, which is why the
// dashboard still shows the calendar; the appUid-keyed readers all silently stopped finding it.
//
// WHAT STAYS BROKEN UNTIL THIS RUNS, even with the server's fallback deployed. The fallback in
// `resolveAppCalendar` only covers `requireCalendar` (add-event and update-calendar). These six
// still key on appUid alone and will keep behaving as though the calendar does not exist:
//   features/booking/{listAvailability,createBooking,bookingEmailHelpers}  ({ uid, appUid })
//   features/analytics/eventInsights          features/marketing-assistant/{collectAppFacts,generateDrafts}
//   features/plugin-proxy/forwardToBot
// So this script, not the fallback, is the actual fix. The fallback is the safety net.
//
// SAFETY. It only ever `$set`s `appUid` on a calendar that an App already points at by `_id`,
// to that same App's `uid`. It never creates, never deletes, never touches an App, and never
// invents a link that was not already in the data. A calendar nothing references is reported
// and LEFT ALONE, because guessing an owner for it is exactly how events get orphaned.

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = resolve(HERE, "../../nexious-server");
const require = createRequire(`${SERVER_DIR}/package.json`);
const { MongoClient } = require("mongodb");

// Atlas SRV records do not resolve through the default resolver on every machine (the server
// hits the same wall and sets DNS_SERVERS in server.ts). Harmless where it already works.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const WRITE = argv.includes("--write");
const DB_NAME = flag("db");

const resolveUri = () => {
  const fromFlag = flag("uri");
  if (fromFlag) return fromFlag;
  const envPath = `${SERVER_DIR}/.env`;
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("MONGOOSE_URI="));
  return line?.slice("MONGOOSE_URI=".length).trim();
};

const uri = resolveUri();
if (!uri) {
  console.error("No connection string. Pass --uri \"<mongodb+srv://...>\" or add MONGOOSE_URI to nexious-server/.env.");
  process.exit(1);
}

// ⚠️ The database in the URI is NOT assumed to be the one you want. nexious-server/.env points at
// `dev` while production is a different database (and possibly a different cluster), so a run
// that silently healed the wrong one would report a clean result and fix nothing.
const client = new MongoClient(uri);
await client.connect();
const dbName = DB_NAME || client.options?.dbName || new URL(uri.replace("mongodb+srv://", "https://")).pathname.slice(1);
if (!dbName) {
  console.error("No database resolved. Pass --db <name>.");
  await client.close();
  process.exit(1);
}
const db = client.db(dbName);

console.log(`\nDatabase : ${dbName}`);
console.log(`Mode     : ${WRITE ? "WRITE (this run changes data)" : "DRY RUN (nothing will be written)"}\n`);

const apps = await db.collection("apps").find({}, { projection: { uid: 1, appName: 1, calendar: 1 } }).toArray();
const calendars = await db
  .collection("calendars")
  .find({}, { projection: { uid: 1, appUid: 1, name: 1, events: 1 } })
  .toArray();
const calById = new Map(calendars.map((c) => [String(c._id), c]));
const referenced = new Set(apps.filter((a) => a.calendar).map((a) => String(a.calendar)));

// DRIFTED: the App points at this calendar by _id, and the calendar's appUid says otherwise.
// String() on both sides so a non-string uid (a Binary from an older seed) compares by value
// rather than by identity and is caught rather than skipped.
const drifted = [];
for (const app of apps) {
  if (!app.calendar) continue;
  const cal = calById.get(String(app.calendar));
  if (!cal) {
    console.log(`DANGLING  ${app.appName} (uid=${app.uid}) -> App.calendar points at a calendar that does not exist. Left alone.`);
    continue;
  }
  if (String(cal.appUid ?? "") !== String(app.uid ?? "")) {
    drifted.push({ app, cal });
  }
}

const unreferenced = calendars.filter((c) => !referenced.has(String(c._id)));

console.log(`apps: ${apps.length}   calendars: ${calendars.length}`);
console.log(`calendars whose appUid disagrees with the app that references them: ${drifted.length}`);
console.log(`calendars no app references (reported, NEVER touched): ${unreferenced.length}\n`);

for (const { app, cal } of drifted) {
  console.log(`  ${app.appName}`);
  console.log(`    calendar : ${cal.name || "(unnamed)"}  _id=${cal._id}  events=${cal.events?.length ?? 0}`);
  console.log(`    appUid   : ${JSON.stringify(cal.appUid ?? null)}  ->  ${JSON.stringify(app.uid)}`);
}
for (const c of unreferenced) {
  console.log(`  UNREFERENCED calendar ${c.name || "(unnamed)"} _id=${c._id} appUid=${JSON.stringify(c.appUid ?? null)} events=${c.events?.length ?? 0}`);
}

if (!drifted.length) {
  console.log("\nNothing to heal.");
  await client.close();
  process.exit(0);
}

if (!WRITE) {
  console.log(`\nDRY RUN. Nothing was written. Re-run with --write to apply ${drifted.length} change(s).`);
  await client.close();
  process.exit(0);
}

let healed = 0;
for (const { app, cal } of drifted) {
  const result = await db.collection("calendars").updateOne({ _id: cal._id }, { $set: { appUid: app.uid } });
  if (result.modifiedCount === 1) healed++;
  else console.log(`  FAILED  calendar _id=${cal._id} (no document modified)`);
}

// Re-read rather than trusting the loop's own tally, so the "after" number is measured.
const after = await db.collection("calendars").find({}, { projection: { uid: 1, appUid: 1 } }).toArray();
const afterById = new Map(after.map((c) => [String(c._id), c]));
const stillDrifted = apps.filter((a) => {
  if (!a.calendar) return false;
  const c = afterById.get(String(a.calendar));
  return c && String(c.appUid ?? "") !== String(a.uid ?? "");
}).length;

console.log(`\nBefore: ${drifted.length} drifted.  Healed: ${healed}.  After: ${stillDrifted} drifted.`);
if (stillDrifted > 0) console.log("WARNING: some rows did not heal. Investigate before re-running.");

await client.close();
