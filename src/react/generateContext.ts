import init from "@data/react.json" with { type: "json" };
import { createFileIfNotExists } from "@nodeDir/createFile.js";
import { readConfig } from "@nodeDir/readFile.js";
import { ContextConfig } from "interface-react";
import { buildContext } from "./buildContext.js";
import { buildReducer } from "./buildReducer.js";
import { buildRequest } from "./buildRequest.js";

const data = await readConfig<{ createContext: ContextConfig[] }>();
if (data) {
  data.configFile.createContext.forEach(async (context) => {
    const currentDir = data.root + context.buildPath + "/" + context.name + "Context";

    const initContext = init.initContext.map((line) => buildContext(line, context));
    const initReducer = init.initReducer.map((line) => buildReducer(line, context));

    createFileIfNotExists(currentDir, currentDir + "/index.ts", initContext.join("\n"));
    createFileIfNotExists(currentDir, currentDir + "/reducer.ts", initReducer.join("\n"));

    context.request.forEach((req) => {
      const file = init.initRequest.map((line) => buildRequest(line, context, req));
      const filename = currentDir + "/request/" + req + "Req.ts";
      createFileIfNotExists(currentDir + "/request", filename, file.join("\n"));
    });
  });
}
