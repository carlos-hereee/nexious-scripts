import fs from "fs/promises";

export const readFile = async (path: string) => {
  try {
    const file = await fs.readFile(path, "utf8");
    if (path.includes(".json")) return JSON.parse(file);
    // otherwise convert to array
    return file.split(/\r?\n/);
  } catch (error) {
    console.log("readFile error", error);
  }
};

export const readDir = async (path: string) => {
  try {
    return await fs.readdir(path, { withFileTypes: true });
  } catch (error) {
    console.log("error", error);
  }
};
