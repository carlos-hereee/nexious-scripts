import fs from "fs/promises";
import type { IUpdateFile } from "./fs.types.js";
import { matchString } from "@utils/matchString.js";
import { generateLogMessage } from "@utils/message.js";
import { readFile } from "./readFile.js";

// ── updateFile ──
// What: line-by-line transform of a text file. Reads the file, runs each line against
//   a regex pattern; when a line matches, passes it to `cb` and replaces the line
//   with whatever cb returns. Only writes back if at least one line was changed.
// Who: called by codegen scripts that need to patch generated files (e.g. insert
//   a new context import into an existing aggregator file).
// When: safe to call any time. The skip-if-unchanged short-circuit makes it cheap
//   to rerun.
// How: ① load file as lines; ② iterate and test match; ③ rewrite entire file if
//   `isModified` flipped to true, otherwise skip.

export const updateFile = async ({ filePath, pattern, cb, isModified = false }: IUpdateFile) => {
  try {
    const file = await readFile<string[]>(filePath);
    if (!file) return generateLogMessage("badRequest");

    const updatedFile = file.map((line) => {
      if (matchString(line, pattern)) {
        isModified = true;
        return cb(line);
      }
      return line;
    });

    if (isModified) {
      await fs.writeFile(filePath, updatedFile.join("\n"));
      return generateLogMessage("success");
    }
    return generateLogMessage("skipped");
  } catch (err) {
    console.error(`updateFile error (${filePath}):`, err);
    return generateLogMessage("badRequest");
  }
};
