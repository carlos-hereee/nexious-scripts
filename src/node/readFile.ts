import fs from "fs/promises";

export const readFile = async (filePath: string, cb: (e: string[]) => void) => {
  try {
    // read file
    const file = await fs.readFile(filePath, "utf8");
    // convert to array
    const lineByLine = file.split(/\r?\n/);
    // pass converted array
    return cb ? cb(lineByLine) : lineByLine;
  } catch (error) {
    console.log("error :>> ", error);
    return null;
  }
};
