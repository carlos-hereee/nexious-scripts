import { renameDispatch, renameName } from "@utils/typography.js";
import type { ContextConfig } from "./codegen.types.js";

// ── buildContext ──
// What: takes one line of the context template and substitutes placeholders with
//   real values for a given ContextConfig (state, dispatch, request arrays).
// Who: called by generateContext.ts once per line in data/react.json's initContext.
// How: string.replace chain. Each placeholder corresponds to a synthesized code
//   fragment, e.g. ${contextDispatch} becomes a semicolon-joined list of
//   `const setX = useCallback(...)` lines.

export const buildContext = (line: string, context: ContextConfig): string => {
  const data = renameName(line, context.name);
  return data
    .replace(
      "${contextDispatch}",
      context.dispatch
        .map(
          (d) =>
            `const ${d} = useCallback((payload) => dispatch({ type: ${renameDispatch(context.name, d.replace("set", ""))}, payload }), []);`
        )
        .join(";")
    )
    .replace("${requestImports}", context.request.map((d) => `import { ${d}Req } from './request/${d}Req'`).join(";"))
    .replace(
      "${contextRequest}",
      context.request
        .map((d) => `const ${d} = useCallback((payload) => ${d}Req({dispatch, setStatus, ...payload}) , [])`)
        .join(";")
    )
    .replace(
      "${contextValues}",
      `${context.state.map((s) => `${s}: state.${s}`).join(",")} , ${context.dispatch
        .map((d) => `${d}`)
        .join(",")} , ${context.request.map((d) => `${d}`).join(",")}`
    )
    .replace("${contextTriggers}", context.state.map((s) => `state.${s}`).join(","));
};
