import { renameDispatch, renameName } from "@utils/typography.js";
import { ContextConfig } from "interface-react";

export const buildContext = (line: string, context: ContextConfig) => {
  const data = renameName(line, context.name);
  return data
    .replace(
      "${contextDispatch}",
      `${context.dispatch.map(
        (d) =>
          `const ${d} = useCallback((payload) => dispatch({ type: ${renameDispatch(context.name, d)}, payload }), []);`
      )}`
    )
    .replace(
      "${contextRequest}",
      context.request
        .map((d) => `const ${d} = useCallback((payload) => ${d}Req({dispatch, setStatus, ...payload}) , [])`)
        .join(";")
    )
    .replace(
      "${contextValues}",
      `{${context.state.map((s) => `${s}: state.${s}`).join(",")} , ${context.dispatch
        .map((d) => `${d}`)
        .join(",")} , ${context.request.map((d) => `${d}`).join(",")}}`
    )
    .replace("${contextTriggers}", context.state.map((s) => `state.${s}`).join(","));
};
