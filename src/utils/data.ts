import message from "@data/message.json";

export const updateFileMessages = {
  success: { message: message.modified, status: "success", error: null },
  skipped: { message: message.skipped, status: "skipped", error: null },
  notFound: { message: message.notFound, status: "skipped", error: null },
  skippedDir: { message: message.skippedDir, status: "skipped", error: null },
};

export const errorMessage = (error: string, msg: string) => {
  return { status: "error", error, message: msg };
};

export const requiredProps = {
  pattern: { message: message.regexRequired, status: "missingProps", error: "missing" },
  filePath: { message: message.filePath, status: "missingProps", error: "missing" },
  cb: { message: message.cb, status: "missingProps", error: "missing" },
  searchPaths: { message: message.searchPaths, status: "missingProps", error: "missing" },
  target: { message: message.target, status: "missingProps", error: "missing" },
};
