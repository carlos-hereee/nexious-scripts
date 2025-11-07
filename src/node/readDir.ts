import fs from "fs/promises";

export const readDir = (directoryPath: string) => fs.readdir(directoryPath, { withFileTypes: true });
