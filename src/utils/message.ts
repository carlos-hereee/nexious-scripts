import { error, success } from "@data/message.json";
import { ErrorName } from "file-paths";

export const generateLogMessage = (err: ErrorName, path?: string) => {
  switch (err) {
    case "notFound":
      return error.notFound;
    case "skipped":
      return { ...error.skipped, message: error.skipped.message + " " + path || "" };
    case "success":
      return success;
    default:
      return error.badRequest;
  }
};
