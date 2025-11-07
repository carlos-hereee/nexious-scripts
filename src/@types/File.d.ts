declare module "file-paths" {
  export type ErrorName = "notFound" | "badRequest" | "success" | "skipped";

  export type StatusPhaseCode = 404 | 202 | 400 | number;
  export interface MessageData {
    // skippedFiles: string[];
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
    cb: (filePath: string) => void;
    target?: string;
    pattern?: string;
    name: string;
    logger?: { [key: string]: MessageData };
    exclude?: { files: string[]; directory: string[] };
  }
}
