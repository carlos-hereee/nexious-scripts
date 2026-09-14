// DEPRECATED: the ambient `declare module "file-paths"` approach was replaced on
// 2026-04-21 with explicit named exports from `src/fs/fs.types.ts`. This file is kept
// so any existing import that still references the "file-paths" module keeps type-
// checking during the transition. Delete after one release cycle.
//
// New usage:
//   import type { IAuthorsPen, MessageData } from "@fs/fs.types.js";

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
    isModified?: boolean;
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
