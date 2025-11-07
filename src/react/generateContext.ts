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

const buildContext = (path: string) => {
  console.log("\n\ninitContext ==>", init.initContext, "\n\n");
  console.log("path", path);
};
const data = await readConfig<PConfig>();
if (data) {
  data.configFile.createContext.forEach(async (context) => {
    const buildPath = data.root + context.buildPath;
    const currentFile = buildPath + "/" + context.name + "Context.tsx";
    // const currentPath = context.name + "Context.tsx";

    const initFile = init.initContext.map((line) => {
      return line
        .replaceAll("${name}", context.name)
        .replaceAll("${lowerCaseName}", context.name.toLowerCase())
        .replace(
          "${contextDispatch}",
          `${context.dispatch.map(
            (d) =>
              `const ${d} = useCallback((payload) => dispatch({ type: A_${context.name.toUpperCase()}.SET_${d
                .replace(regex.camelCaseToUnderscore, "$1_$2")
                .toUpperCase()}, payload }), []);`
          )}`
        )
        .replace(
          "${contextRequest}",
          `${context.request.map((d) => `const ${d} = useCallback((payload) => ${d}Req({dispatch, setStatus, ...payload}) , [])`).join(";")}`
        )
        .replace(
          "${contextValues}",
          `{${context.state.map((s) => `${s}: state.${s}`).join(",\\n")} , ${context.dispatch.map((d) => `${d}`).join(",\\n")} , ${context.request.map((d) => `${d}`).join(",\\n")}}`
        )
        .replace("${contextTriggers}", context.state.map((s) => `state.${s}`).join(","));
    });
    createFileIfNotExists(currentFile, initFile.join("\n"));
    // createFileIfNotExists(currentPath, initFile.join("\n"));
  });
  // await authorsPen({ currentPath: buildPath, cb: (path) => buildContext(path), name: context.name });
  // buildContext(buildPath);

  // console.log("context", context);
}
