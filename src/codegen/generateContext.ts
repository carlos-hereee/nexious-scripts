import init from "@data/react.json" with { type: "json" };
import { createFileIfNotExists } from "@fs/createFile.js";
import { readConfig } from "@fs/readFile.js";
import type { ContextConfig } from "./codegen.types.js";
import { buildContext } from "./buildContext.js";
import { buildReducer } from "./buildReducer.js";
import { buildRequest } from "./buildRequest.js";

// ── generateContext ──
// What: entry point for the context codegen. Reads a consumer-supplied config JSON,
//   iterates its createContext list, and emits three files per entry:
//     <Name>Context/index.tsx , provider + useMemo-wrapped value
//     <Name>Context/reducer.tsx, discriminated-union reducer + A_<NAME> enum
//     <Name>Context/request/<req>Req.ts, async request wrappers
// Who: invoked via the CLI (`nexious-context <config.json>`) or as the old
//   `npm run generateContext` script.
// Where: this is the glue between the template data in data/react.json and the line
//   transformers in buildContext/buildReducer/buildRequest.
// How:
//   ① read config via readConfig (already handles the cwd + args parsing)
//   ② for each ContextConfig, compute the output directory relative to the consumer
//      project root
//   ③ transform each template line through the appropriate builder and concat
//   ④ write the files idempotently via createFileIfNotExists

const main = async () => {
  const data = await readConfig<{ createContext: ContextConfig[] }>();
  if (!data) return;

  for (const context of data.configFile.createContext) {
    const currentDir = data.root + context.buildPath + "/" + context.name + "Context";

    const initContext = init.initContext.map((line) => buildContext(line, context));
    const initReducer = init.initReducer.map((line) => buildReducer(line, context));

    await createFileIfNotExists(currentDir, currentDir + "/index.tsx", initContext.join("\n"));
    await createFileIfNotExists(currentDir, currentDir + "/reducer.tsx", initReducer.join("\n"));

    for (const req of context.request) {
      const file = init.initRequest.map((line) => buildRequest(line, context, req));
      const filename = currentDir + "/request/" + req + "Req.ts";
      await createFileIfNotExists(currentDir + "/request", filename, file.join("\n"));
    }
  }
};

main();
