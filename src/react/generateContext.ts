import init from "@data/react.json" with { type: "json" };
import { createFileIfNotExists } from "@nodeDir/createFile.js";
import { readConfig } from "@nodeDir/readFile.js";
import { ContextConfig } from "interface-react";
import { buildContext } from "./buildContext";

interface PConfig {
  createContext: ContextConfig[];
}

const data = await readConfig<PConfig>();
if (data) {
  data.configFile.createContext.forEach(async (context) => {
    const buildPath = data.root + context.buildPath;
    const contextFile = buildPath + "/" + context.name + "Context/index.tsx";
    const currentDir = buildPath + "/" + context.name + "Context";
    const initContext = init.initContext.map((line) => buildContext(line, context));

    createFileIfNotExists(currentDir, contextFile, initContext.join("\n"));
  });
}
