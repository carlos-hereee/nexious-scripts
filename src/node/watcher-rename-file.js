import fs from "fs";
import { spawn } from "child_process";

const targetFile = "./scripts/renameFile.sh"; // Replace with your target file
const executeFile = "./scripts/save-rename.js"; // Replace with the file you want to execute

fs.watch(targetFile, (eventType, filename) => {
  if (filename && eventType === "change") {
    console.log(`File ${filename} has changed. Executing ${executeFile}...`);

    // Execute the different file using child_process.spawn
    const child = spawn("node", [executeFile]);

    child.stdout.on("data", (data) => {
      console.log(`${filename}: ${data}`);
    });

    child.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`'${executeFile}' executed successfully.`);
      } else {
        console.error(`'${executeFile}' failed with code ${code}.`);
      }
    });
  }
});

console.log(`Watching for changes on path ${targetFile} ...`);
