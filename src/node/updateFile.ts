import fs from "fs/promises";
import { matchString } from "../utils/matchString.js";
import { generateLogMessage } from "../utils/message.js";
import data from "@data/message.json" with { type: "json" };
import type { IUpdateFile } from "file-paths";

export const updateFile = async ({ filePath, pattern, cb }: IUpdateFile) => {
  try {
    // require key variables
    if (!pattern) throw Error(data.error.regexPattern.message);
    if (!filePath) throw Error(data.error.filePath.message);
    if (!cb) throw Error(data.error.cb.message);
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
      return generateLogMessage("success");
    }
    // otherwise skip update and return status
    return generateLogMessage("skipped");
    // update file
  } catch (error) {
    return generateLogMessage("badRequest");
  }
};
