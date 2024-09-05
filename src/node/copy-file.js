import fs from "fs";

export const copyFile = (filePath, destinationPath) =>
  fs.copyFile(filePath, destinationPath, (err) => {
    if (err) {
      console.log("err", err);
      throw err;
    }
    // eslint-disable-next-line no-console
    console.log("File copied sucessfully");
  });
