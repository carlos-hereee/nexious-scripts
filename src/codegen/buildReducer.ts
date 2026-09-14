import { modifyCasing, renameDispatch, renameName } from "@utils/typography.js";
import type { ContextConfig } from "./codegen.types.js";

// ── buildReducer ──
// What: substitutes placeholders in one line of the reducer template.
// How: ${reducerTypes} becomes a comma-joined list of UPPER_SNAKE action names;
//   ${reducerCase} becomes the switch body with one case per state field.

export const buildReducer = (line: string, reducer: ContextConfig): string => {
  const data = renameName(line, reducer.name);
  return data
    .replace("${reducerTypes}", reducer.state.map((s) => modifyCasing(s, "camelTo_")).join(","))
    .replace(
      "${reducerCase}",
      reducer.state
        .map((s) => `  case ${renameDispatch(reducer.name, s)}: return { ...state, ${s}: action.payload } `)
        .join(";")
    );
};
