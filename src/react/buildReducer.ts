import { modifyCasing, renameDispatch, renameName } from "@utils/typography.js";
import { ContextConfig } from "interface-react";

export const buildReducer = (line: string, reducer: ContextConfig) => {
  const data = renameName(line, reducer.name);
  return data
    .replace("${reducerTypes}", reducer.state.map((s) => `SET_${modifyCasing(s, "camelTo_")}`).join(","))
    .replace(
      "${reducerCase}",
      reducer.state
        .map((s) => `  case ${renameDispatch(reducer.name, s)}: return { ...state, ${s}: action.payload } `)
        .join(";")
    );
};
