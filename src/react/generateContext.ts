import init from "@data/react.json" with { type: "json" };
import { readConfig } from "@nodeDir/readFile.js";
import { ContextConfig } from "interface-react";
import { buildContext } from "./buildContext.js";
import { buildReducer } from "./buildReducer.js";

const data = await readConfig<{ createContext: ContextConfig[] }>();
if (data) {
  data.configFile.createContext.forEach(async (context) => {
    const buildPath = data.root + context.buildPath;
    const contextFile = buildPath + "/" + context.name + "Context/index.tsx";
    const currentDir = buildPath + "/" + context.name + "Context";
    const initContext = init.initContext.map((line) => buildContext(line, context));
    const initReducer = init.initReducer.map((line) => buildReducer(line, context));
    const requests = context.request.forEach((req) => {
      console.log("\n\nreq ==>", req, "\n\n");
    });
    console.log("\n\nrequest ==>", requests, "\n\n");
    // console.log("\n\ninitContext ==>", initContext, "\n\n");
    // createFileIfNotExists(currentDir, contextFile, initContext.join("\n"));
  });
}
