import fs from "fs/promises";
import { matchString } from "../utils/matchString";
import { errorMessage, updateFileMessages } from "../utils/message";
import { error } from "@data/message.json";
import { IUpdateFile } from "file-paths";

export const updateFile = async ({ filePath, pattern, cb }: IUpdateFile) => {
  try {
    // require key variables
    if (!pattern) throw Error(error.regexPattern.message);
    if (!filePath) throw Error(error.filePath.message);
    if (!cb) throw Error(error.cb.message);
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
