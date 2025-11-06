declare module "file-paths" {
  export type ErrorName = "notFound" | "badRequest" | "success" | "skipped";

  export type StatusPhaseCode = 404 | 202 | 400 | number;
  export interface MessageData {
    message: string;
    status: string;
    code: StatusPhaseCode;
  }
  export interface CopyFileParams {
    filePath: string;
    destinationPath: string;
  }
  export interface IUpdateFile {
    filePath: string;
    pattern: string;
    cb: (e: unknown) => void;
  }
  export interface IAuthorsPen {
    currentPath: string;
    exclude: { files: string[]; directory: string[] };
    target: string;
    cb: (e: unknown) => void;
    logger: { [key: string]: MessageData };
    pattern: string;
  }
}
