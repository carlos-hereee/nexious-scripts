// ─────────────────────────────────────────────────────────────────────────────
// backfill-app-link.js  (2026-08 item 75 part 1)
// One-off data fix: normalize every App's derived paths to the canonical shape
// the server's appPaths helper builds from appName:
//   appLink = "/" + appName with spaces as "+"     (e.g. "/Iron+Forge")
//   appUrl  = "/app/" + the same slug              (e.g. "/app/Iron+Forge")
//
// Legacy docs carry raw spaces, hand-made slugs, doubled slashes, or values
// drifted by an old rename. The App model now re-derives both fields in a
// pre-validate hook on every .save(), so any doc that saves heals itself; this
// script covers the historical docs that never save again.
//
// NOTE the canonical shape KEEPS the leading slash, matching appPaths
// (nexious-server src/utils/app/generateUrl.ts). The FUTURE_PLANS item 75 entry
// originally said to strip it; appPaths standardized the with-slash shape after
// that was written, and the code wins. Do not "fix" this script to strip it.
//
// Run in EITHER:
//   • Compass embedded shell (preferred per project workflow). Paste this whole
//     file into the shell after selecting the platform database.
//   • mongosh CLI:
//       mongosh "<your-prod-connection-string>" --file backfill-app-link.js
//
// Idempotent. A second run finds zero drifted documents and does nothing.
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of the server's generateStringUrl: spaces to "+", then trim. Kept
// inline because this runs in a bare mongo shell with no imports.
function slugOf(appName) {
  return appName.split(" ").join("+").trim();
}

const apps = db.apps.find({}, { appName: 1, appLink: 1, appUrl: 1 }).toArray();
let updated = 0;
let skippedNoName = 0;

for (const app of apps) {
  if (typeof app.appName !== "string" || !app.appName.trim()) {
    // No appName means nothing to derive from; the hook skips these too.
    // Investigate by hand rather than inventing a slug here.
    skippedNoName++;
    print(`  SKIP (no appName)  _id=${app._id}`);
    continue;
  }
  const slug = slugOf(app.appName.trim());
  const want = { appLink: `/${slug}`, appUrl: `/app/${slug}` };
  if (app.appLink === want.appLink && app.appUrl === want.appUrl) continue;
  const result = db.apps.updateOne({ _id: app._id }, { $set: want });
  if (result.modifiedCount === 1) {
    updated++;
    print(`  OK  ${app.appName}  ${app.appLink} -> ${want.appLink}`);
  } else {
    print(`  FAILED  _id=${app._id}  (no document modified)`);
  }
}

print("");
print(`Normalized ${updated} of ${apps.length} app(s).`);
if (skippedNoName > 0) {
  print(`WARNING: ${skippedNoName} document(s) have no appName and were left alone. Investigate by hand.`);
}
