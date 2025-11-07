import { generateLogMessage } from "@utils/message.js";
import type { IAuthorsPen, MessageData } from "file-paths";
import { readDir } from "./readFile.js";

interface Skip {
  list: string[];
  fileName: string;
  name: string;
  logger: { [key: string]: MessageData };
}
const canSkip = ({ fileName, list, logger = {}, name }: Skip) => {
  // skip excluded directory
  const canSkipDir = list.some((d) => fileName.includes(d));
  if (canSkipDir) {
    logger[name] = generateLogMessage("skipped");
    // logger[name] = { ...logger[name],skippedFiles: generateLogMessage("skipped")};
    return true;
  }
  return false;
};

// recursively traverse directory
export const authorsPen = async ({
  currentPath,
  cb,
  // if undefined use default
  exclude = { files: [], directory: [] },
  logger = {},
  name,
}: IAuthorsPen) => {
  // read files and directories in path
  const directory = await readDir(currentPath);
  // if no directory was found log result
  if (!directory) return (logger[currentPath] = generateLogMessage("notFound"));
  // search for deserired files
  for (let file of directory) {
    const filePath = `${currentPath}/${file.name}`;
    const params = { logger, fileName: file.name, name };
    //  file is found fire callback
    if (file.isFile() && !canSkip({ list: exclude.files, ...params })) cb(filePath);
    // otherwise rinse and repeat recursively
    if (file.isDirectory() && !canSkip({ list: exclude.directory, ...params })) {
      await authorsPen({ currentPath: filePath, ...params, cb });
    }
  }
  return logger;
};
