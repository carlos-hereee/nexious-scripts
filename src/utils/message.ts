import data from "@data/message.json" with { type: "json" };
import { ErrorName } from "file-paths";

export const generateLogMessage = (err: ErrorName, path?: string) => {
  switch (err) {
    case "notFound":
      return data.error.notFound;
    case "skipped":
      return { ...data.error.skipped, message: data.error.skipped.message + " " + path || "" };
    case "success":
      return data.success;
    default:
      return data.error.badRequest;
  }
};
