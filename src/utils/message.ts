import data from "@data/message.json" with { type: "json" };
import type { ErrorName } from "@fs/fs.types.js";

// ── generateLogMessage ──
// What: returns a structured message object describing the outcome of a script
//   action, keyed by an ErrorName.
// Who: called by fs/ scripts and anywhere else we want a consistent log shape.
// Why structured: callers can render, serialize, or branch on `code` and `status`
//   without parsing strings.
// Bug history: the previous implementation appended path via `msg + " " + path || ""`
//   which evaluates as `(msg + " " + path) || ""`, so when `path` was undefined the
//   result was literally "Skipped! undefined". Parentheses fixed below.

export const generateLogMessage = (err: ErrorName, path?: string) => {
  switch (err) {
    case "notFound":
      return data.error.notFound;
    case "skipped":
      return {
        ...data.error.skipped,
        message: data.error.skipped.message + " " + (path || ""),
      };
    case "success":
      return data.success;
    default:
      return data.error.badRequest;
  }
};
