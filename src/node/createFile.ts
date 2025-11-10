import fs from "fs/promises";

export const createFileIfNotExists = async (currentDir: string, filePath: string, content: string = "") => {
  try {
    // Ensure the directory exists, create it recursively if not
    await fs.mkdir(currentDir, { recursive: true });

    // Check if the file exists
    await fs.access(filePath, fs.constants.F_OK);
    console.log(`File '${filePath}' already exists. Skipping creation.`);
    // update file
    await fs.writeFile(filePath, content);
  } catch (error: any) {
    // If fs.access throws an error, it means the file does not exist
    if (error.code === "ENOENT") {
      await fs.writeFile(filePath, content);
      console.log(`File '${filePath}'==> created successfully.`);
    } else {
      console.error(`Error checking or creating file '${filePath}':`, error);
    }
  }
};
