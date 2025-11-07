import { authorsPen } from "@nodeDir/authorsPen.js";
import { loadArgs } from "@nodeDir/loadArgs.js";

interface P {
  search: string;
}
const { config } = loadArgs({});
export const generateContext = async ({ search }: P) => {
  console.log("\n\ncurrentPath", search + "\n\n");
  const logger = await authorsPen({ currentPath: search, cb: (e) => console.log("e", e) });
  console.log("logger", logger);
  // for (let num = 0; num < search.length; num += 1) {
  //   const currentPath = search[num];
  //   console.log("starting search on :>> ", currentPath);
  //   authorsPen({ currentPath, cb: (e) => console.log("e", e) });
  // }
};
generateContext({ search: config });
