import type { IUpdateFile } from "file-paths";
import fs from "fs/promises";
import { matchString } from "../utils/matchString.js";
import { generateLogMessage } from "../utils/message.js";
import { readFile } from "./readFile.js";

export const updateFile = async ({ filePath, pattern, cb, isModified = false }: IUpdateFile) => {
  try {
    const file = await readFile<string[]>(filePath);
    if (!file) return generateLogMessage("badRequest");

    // iterate and match with desired partern
    const updatedFile = file.map((line) => {
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
