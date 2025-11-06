import message from "@data/message.json";

export const updateFileMessages = {
  success: { message: message.modified, status: "success", error: null },
  skipped: { message: message.skipped, status: "skipped", error: null },
  notFound: { message: message.notFound, status: "skipped", error: null },
  skippedDir: { message: message.skippedDir, status: "skipped", error: null },
};

export const errorMessage = (error: unknown, msg: string) => {
  return { status: "error", error, message: msg };
};
