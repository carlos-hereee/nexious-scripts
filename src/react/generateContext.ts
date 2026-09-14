// Moved to src/codegen/generateContext.ts. The new location is the canonical
// entry point and is registered in package.json as the `nexious-context` bin.
// This tombstone just re-runs the new entry so older `node dist/react/generateContext`
// invocations still work during the transition.
import "@codegen/generateContext.js";
