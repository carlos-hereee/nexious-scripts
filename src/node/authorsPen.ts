import type { IAuthorsPen } from "file-paths";
import { readDir } from "./readDir.js";
import { updateFile } from "./updateFile.js";
import { generateLogMessage } from "@utils/message.js";

// recursively traverse directory
export const authorsPen = async ({
  currentPath,
  cb,
  target = "",
  pattern = "",
  // if undefined use default
  exclude = { files: [], directory: [] },
  logger = {},
}: IAuthorsPen) => {
  // read files and directories in path
  const directory = await readDir(currentPath);
  // if no directory was found log result
  if (!directory) return (logger[currentPath] = generateLogMessage("notFound"));
  // search for deserired files
  for (let file of directory) {
    const filePath = `${currentPath}/${file.name}`;
    if (file.isDirectory()) {
      // skip excluded directory
      const canSkipDir = exclude.directory.some((d) => file.name.includes(d));
      if (canSkipDir) logger[filePath] = generateLogMessage("skipped");
      // otherwise rinse and repeat recursively
      else await authorsPen({ currentPath: filePath, exclude, target, cb, logger, pattern });
    }
    if (file.isFile()) {
      //   skip exludedFiles
      const canSkipFile = exclude.files.some((f) => file.name.includes(f));
      if (canSkipFile) logger[filePath] = generateLogMessage("skipped");
      else {
        // if file is target file fire callback and log result
        if (file.name.includes(target)) {
          const result = await updateFile({ filePath, pattern, cb });
          logger[filePath] = result;
        }
      }
    }
  }
  return logger;
};
