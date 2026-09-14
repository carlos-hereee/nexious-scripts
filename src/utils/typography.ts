import type { TCasing } from "@codegen/codegen.types.js";

// ── typography helpers ──
// What: string-case transforms used by the codegen templates.
// Who: called by buildContext/buildReducer/buildRequest line transformers.
// Why: the templates reference ${name}, ${nameLower}, ${nameUpper}, and a
//   SCREAMING_SNAKE action prefix. These three helpers own those conversions in one
//   place so the codegen stays consistent.

export const modifyCasing = (data: string, casing: TCasing): string => {
  switch (casing) {
    case "upper":
      return data.toUpperCase();
    case "lower":
      return data.toLowerCase();
    case "camelTo_":
      // Insert underscore between lower-to-upper boundaries, then upper the whole
      // string. "userName" -> "USER_NAME"; "userID" -> "USER_ID".
      return data.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
    default:
      return data;
  }
};

export const renameName = (data: string, target: string): string => {
  return data
    .replaceAll("${name}", target)
    .replaceAll("${nameLower}", modifyCasing(target, "lower"))
    .replaceAll("${nameUpper}", modifyCasing(target, "upper"));
};

export const renameDispatch = (name: string, target: string): string => {
  return `A_${modifyCasing(name, "upper")}.${modifyCasing(target, "camelTo_")}`;
};
