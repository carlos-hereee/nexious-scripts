import { copyFile as cp } from "fs";

export const copyFile = (filePath: string, destinationPath: string) => {
  return cp(filePath, destinationPath, (err: unknown) => {
    if (err) {
      console.log("err", err);
      throw err;
    }
    // eslint-disable-next-line no-console
    console.log("File copied sucessfully");
  });
};
