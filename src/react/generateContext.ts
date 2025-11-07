import { authorsPen } from "@nodeDir/authorsPen.js";
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
  console.log("path", path);
};
const data = await readConfig<PConfig>();
if (data) {
  data.configFile.createContext.forEach(async (context) => {
    const buildPath = data.root + context.buildPath;
    await authorsPen({ currentPath: buildPath, cb: (path) => buildContext(path), name: context.name });
    // console.log("context", context);
  });
}

// console.log("logger", logger);
// for (let num = 0; num < search.length; num += 1) {
//   const currentPath = search[num];
//   console.log("starting search on :>> ", currentPath);
//   authorsPen({ currentPath, cb: (e) => console.log("e", e) });
// }
