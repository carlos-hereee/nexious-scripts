// ── fs.types ──
// What: types for the filesystem utilities in src/fs/. Replaces the old ambient
//   `declare module "file-paths"` approach with proper named exports, so consumers
//   import the types explicitly instead of relying on global type merging (which is
//   a trap: one stale .d.ts and every caller silently breaks).
// Who: imported by authorsPen.ts, updateFile.ts, and anything else that wants these
//   shapes.

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
  cb: (line: string) => string;
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
