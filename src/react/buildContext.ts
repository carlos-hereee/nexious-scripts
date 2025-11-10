import regex from "@data/regex.json";
import { ContextConfig } from "interface-react";

export const buildContext = (line: string, context: ContextConfig) => {
  return line
    .replaceAll("${name}", context.name)
    .replaceAll("${lowerCaseName}", context.name.toLowerCase())
    .replace(
      "${contextDispatch}",
      `${context.dispatch.map(
        (d) =>
          `const ${d} = useCallback((payload) => dispatch({ type: A_${context.name.toUpperCase()}.${d
            .replace(regex.camelCaseToUnderscore, "$1_$2")
            .toUpperCase()}, payload }), []);`
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
