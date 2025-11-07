import init from "@data/react.json" with { type: "json" };
import regex from "@data/regex.json" with { type: "json" };
import { createFileIfNotExists } from "@nodeDir/createFile.js";
import { readConfig } from "@nodeDir/readFile.js";

interface ContextConfig {
  name: string;
  buildPath: string;
  state: string[];
  dispatch: string[];
  request: string[];
}
interface PConfig {
  createContext: ContextConfig[];
}

const buildContext = (line: string, context: ContextConfig) => {
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

const data = await readConfig<PConfig>();
if (data) {
  data.configFile.createContext.forEach(async (context) => {
    const buildPath = data.root + context.buildPath;
    const contextFile = buildPath + "/" + context.name + "Context/context.tsx";
    const currentDir = buildPath + "/" + context.name + "Context";
    const initContext = init.initContext.map((line) => buildContext(line, context));

    createFileIfNotExists(currentDir, contextFile, initContext.join("\n"));
  });
}
