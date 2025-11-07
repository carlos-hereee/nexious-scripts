import fs from "fs/promises";
import { loadArgs } from "./loadArgs.js";

export const readFile = async <T>(path: string) => {
  try {
    const file = await fs.readFile(path, "utf8");
    if (path.includes(".json")) return JSON.parse(file) as T;
    // otherwise convert to array
    return file.split(/\r?\n/) as T;
  } catch (error) {
    console.log("readFile error ==>", error);
    return null;
  }
};

export const readDir = async (path: string) => {
  try {
    return await fs.readdir(path, { withFileTypes: true });
  } catch (error) {
    console.log("error", error);
  }
};

// read config file
export const readConfig = async <T>(): Promise<{ configFile: T; root: string } | null> => {
  try {
    const { config, root } = loadArgs();
    const configFile = await readFile<T>(config);
    if (!configFile) {
      console.log("config path not set up", configFile);
      return null;
    }
    return { configFile, root };
  } catch (error) {
    console.log("Erro reading config file", error);
    return null;
  }
};
