import { copyFile } from "fs";
import { join } from "path";

// Define the source and destination paths
const filePath = "./scripts/renameFile.sh";
const destPath = join("dist", filePath);

// Copy the file
copyFile(filePath, destPath, (err) => {
  if (err) {
    console.log("error copying ", filePath, err);
    throw err;
  }
});
console.log(`Copied '${filePath}' to '${destPath}'`);
