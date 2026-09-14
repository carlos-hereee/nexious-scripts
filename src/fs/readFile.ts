import fs from "fs/promises";
import { loadArgs } from "./loadArgs.js";

// ── readFile ──
// What: reads a text file. If the path ends in .json, parses and returns the parsed
//   value; otherwise returns the file split into lines.
// Who: called by scripts that operate on config (JSON) or line-based text.
// Why: unifies the two most common "I want to read a file" shapes so callers do not
//   branch on extension themselves.

export const readFile = async <T>(path: string): Promise<T | null> => {
  try {
    const file = await fs.readFile(path, "utf8");
    if (path.endsWith(".json")) return JSON.parse(file) as T;
    return file.split(/\r?\n/) as T;
  } catch (err) {
    console.error(`readFile error (${path}):`, err);
    return null;
  }
};

export const readDir = async (path: string) => {
  try {
    return await fs.readdir(path, { withFileTypes: true });
  } catch (err) {
    console.error(`readDir error (${path}):`, err);
    return undefined;
  }
};

// ── readConfig ──
// What: thin wrapper that resolves the config path via loadArgs, then reads it. Null
//   if either step fails. Returns the project root alongside so the caller does not
//   have to compute it twice.
// Who: codegen entry points that need config+root to build output paths.
export const readConfig = async <T>(): Promise<{ configFile: T; root: string } | null> => {
  try {
    const { config, root } = loadArgs();
    const configFile = await readFile<T>(config);
    if (!configFile) {
      console.error(`readConfig: config file not found at ${config}`);
      return null;
    }
    return { configFile, root };
  } catch (err) {
    console.error("readConfig error:", err);
    return null;
  }
};
