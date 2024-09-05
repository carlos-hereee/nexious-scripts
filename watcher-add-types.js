import fs from "fs";
import path from "path";

const sourceFolder = "./src/@types";
const targetFolder = "./dist/esm/@types";

// add files if not included already no files left behind
const noFileLeftBehid = () => {
  const filesInFolder1 = fs.readdirSync(sourceFolder);
  const filesInFolder2 = fs.readdirSync(targetFolder);
  // Create the target folder if it doesn't exist
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }
  // Iterate through files in folder1
  filesInFolder1.forEach((filename) => {
    const sourceFilePath = path.join(sourceFolder, filename);
    const targetFilePath = path.join(targetFolder, filename);
    //  copy a file if it doesn't already exist
    if (!filesInFolder2.includes(filename)) {
      fs.copyFileSync(sourceFilePath, targetFilePath);
      console.log(`Copied: ${sourceFilePath} to ${targetFilePath}`);
    }
  });
  console.log("Sync complete.");
};

noFileLeftBehid();
fs.watch(sourceFolder, (eventType, filename) => {
  if ((eventType = "rename" || eventType === "change")) {
    console.log(`File ${filename} has changed. Executing `);
  } else if (eventType === "unlink") {
    // handle file deletion
    const targetFilePath = path.join(targetFolder, filename);
    // remove file
    fs.unlinkSync(targetFilePath);
    console.log("Deleted: ", targetFilePath);
  }
  // handle the change event modified or created
  const sourceFolderPath = path.join(sourceFolder, filename);
  const targetFolderPath = path.join(targetFolder, filename);
  fs.copyFileSync(sourceFolderPath, targetFolderPath);
  console.log(`Copied: ${sourceFolderPath} to ${targetFolderPath}`);
});
console.log(`Watching ${sourceFolder} for changes...`);
