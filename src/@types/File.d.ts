declare module "file-paths" {
  export interface CopyFileParams {
    filePath: string;
    destinationPath: string;
  }
  export interface IUpdateFile {
    filePath: string;
    pattern: string;
    cb: (e: unknown) => void;
  }
}
