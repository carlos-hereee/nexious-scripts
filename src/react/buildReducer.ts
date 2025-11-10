import { renameDispatch, renameFileImports } from "@utils/typography.js";
import { ContextConfig } from "interface-react";

export const buildDispatchTypes = (line: string, reducer: ContextConfig) => {};
export const buildReducer = (line: string, reducer: ContextConfig) => {
  const data = renameFileImports(line, reducer.name);
  return data.replace(
    "${reducerCase}",
    reducer.state
      .map((s) => `  case ${renameDispatch(reducer.name, s)}: return { ...state, ${s}: action.payload } `)
      .join(";")
  );
};
