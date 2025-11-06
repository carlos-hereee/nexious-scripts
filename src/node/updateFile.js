import fs from "fs/promises";
import { matchString } from "./matchString.js";
import { errorMessage, requiredProps, updateFileMessages } from "../utils/data.js";

export const updateFile = async ({ filePath, pattern, cb }) => {
  try {
    // require key variables
    if (!pattern) throw Error(requiredProps.regexPattern);
    if (!filePath) throw Error(requiredProps.filePath);
    if (!cb) throw Error(requiredProps.cb);
    // keep track of modified files
    let isModified = false;
    // read file
    const file = await fs.readFile(filePath, "utf8");
    // convert to array
    const lineByLine = file.split(/\r?\n/);
    // iterate and match with desired partern
    const updatedFile = lineByLine.map((line) => {
      // if match fire cb
      if (matchString(line, pattern)) {
        // update tracker
        isModified = true;
        return cb(line);
      }
      // otherwise  line remains unchanged
      return line;
    });
    // if the file meets conditions
    if (isModified) {
      // update file
      // console.log("updatedFile :>> ", updatedFile);
      await fs.writeFile(filePath, updatedFile.join("\n"));
      return updateFileMessages.success;
    }
    // otherwise skip update and return status
    return updateFileMessages.skipped;
    // update file
  } catch (error) {
    return errorMessage(error, "unable to update file");
  }
};
