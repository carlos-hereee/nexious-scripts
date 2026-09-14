import { generateLogMessage } from "@utils/message.js";
import type { IAuthorsPen, MessageData } from "./fs.types.js";
import { readDir } from "./readFile.js";

// ── authorsPen ──
// What: recursively walks a directory tree, calling `cb` on every file and recursing
//   into every sub-directory that is not in the exclude list.
// Who: used by scripts that need to process every file under a path (rename, lint,
//   codegen). The consumer supplies `cb` to decide what to do per file.
// When: always safe to call; pure filesystem reads plus a callback. Does not write.
// Where: the central directory traversal primitive for this library. Every feature
//   that walks a tree should use this rather than re-implementing.
// How: breadth traversal via async recursion. Logs skipped dirs into a mutable logger
//   so the caller can audit what was touched without us threading results through
//   the return value.

interface Skip {
  list: string[];
  fileName: string;
  name: string;
  logger: { [key: string]: MessageData };
}

const canSkip = ({ fileName, list, logger, name }: Skip): boolean => {
  // `list.some` instead of `includes` so we support partial-path matches like
  // "node_modules" matching "foo/node_modules/bar".
  const hit = list.some((d) => fileName.includes(d));
  if (hit) {
    logger[name] = generateLogMessage("skipped");
    return true;
  }
  return false;
};

export const authorsPen = async ({
  currentPath,
  cb,
  exclude = { files: [], directory: [] },
  logger = {},
  name,
}: IAuthorsPen) => {
  const directory = await readDir(currentPath);
  if (!directory) {
    logger[currentPath] = generateLogMessage("notFound");
    return logger;
  }

  for (const file of directory) {
    const filePath = `${currentPath}/${file.name}`;
    const params = { logger, fileName: file.name, name };
    if (file.isFile() && !canSkip({ list: exclude.files, ...params })) cb(filePath);
    if (file.isDirectory() && !canSkip({ list: exclude.directory, ...params })) {
      await authorsPen({ currentPath: filePath, cb, exclude, logger, name });
    }
  }
  return logger;
};
