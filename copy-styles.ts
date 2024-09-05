// eslint-disable-next-line
import fs from "node:fs";

fs.copyFile("./src/stylesheets/index.css", "./dist/esm/stylesheets/index.css", (err) => {
  if (err) {
    console.log("err", err);
    throw err;
  }
  // eslint-disable-next-line no-console
  console.log("stylesheets copied sucessfully");
});
fs.copyFile(
  "./src/stylesheets/index.css.map",
  "./dist/esm/stylesheets/index.css.map",
  (err) => {
    if (err) {
      console.log("err", err);
      throw err;
    }
    // eslint-disable-next-line no-console
    console.log("css map copied sucessfully");
  }
);
