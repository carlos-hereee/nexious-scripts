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

const data = await readConfig<PConfig>();
console.log("data", data);
// const logger = await authorsPen({ currentPath: search, cb: (e) => console.log("e", e) });
// console.log("logger", logger);
// for (let num = 0; num < search.length; num += 1) {
//   const currentPath = search[num];
//   console.log("starting search on :>> ", currentPath);
//   authorsPen({ currentPath, cb: (e) => console.log("e", e) });
// }
