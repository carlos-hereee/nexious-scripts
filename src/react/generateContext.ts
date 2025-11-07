import { authorsPen } from "@nodeDir/authorsPen.js";
import { loadArgs } from "@nodeDir/loadArgs.js";
import { readFile } from "@nodeDir/readFile.js";

interface P {
  search: string;
}
const { config } = loadArgs({});
export const generateContext = async ({ search }: P) => {
  // read config file
  const file = await readFile(search, (e) => console.log("e", e));
  console.log("file", file);
  // const logger = await authorsPen({ currentPath: search, cb: (e) => console.log("e", e) });
  // console.log("logger", logger);
  // for (let num = 0; num < search.length; num += 1) {
  //   const currentPath = search[num];
  //   console.log("starting search on :>> ", currentPath);
  //   authorsPen({ currentPath, cb: (e) => console.log("e", e) });
  // }
};
generateContext({ search: config });
