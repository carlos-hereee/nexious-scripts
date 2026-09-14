// ─────────────────────────────────────────────────────────────────────────────
// backfill-app-uid.js
// One-off data fix: assign a fresh v4 uid to any App document that is missing
// the `uid` field. The schema declares `uid` as required with default v4, but
// apps created before that rule was added never got backfilled.
//
// Run in EITHER:
//   • Compass embedded shell (preferred per project workflow). Just paste this
//     entire file contents into the shell at the bottom of the Compass window
//     after you have selected the platform database.
//   • mongosh CLI:
//       mongosh "<your-prod-connection-string>" --file backfill-app-uid.js
//
// Idempotent. Running it again after a successful run finds zero documents
// and does nothing.
// ─────────────────────────────────────────────────────────────────────────────

const targets = db.apps.find({ uid: { $exists: false } }).toArray();
print(`Found ${targets.length} app(s) without a uid field.`);

if (targets.length === 0) {
  print("Nothing to backfill. Done.");
} else {
  let updated = 0;
  let failed = 0;
  for (const app of targets) {
    // crypto.randomUUID() is available in both mongosh and Compass shell
    // (Node 14.17+). Returns a standard RFC 4122 v4 UUID like
    // "550e8400-e29b-41d4-a716-446655440000" which matches the schema's
    // existing default and is URL-safe (hex + dash only).
    const newUid = crypto.randomUUID();
    const result = db.apps.updateOne(
      { _id: app._id },
      { $set: { uid: newUid } }
    );
    if (result.modifiedCount === 1) {
      updated++;
      print(`  OK  ${app.appName || "(no name)"}  _id=${app._id}  uid=${newUid}`);
    } else {
      failed++;
      print(`  FAILED  _id=${app._id}  (no document modified)`);
    }
  }
  print("");
  print(`Backfilled ${updated} of ${targets.length}.`);
  if (failed > 0) {
    print(`WARNING: ${failed} document(s) failed to update. Investigate before re-running.`);
  }
}
