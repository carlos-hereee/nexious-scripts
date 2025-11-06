// const readDir = require("./helpers/node/readDir");
// const renameImport = require("./helpers/node/renameImport");
// const updateFile = require("./helpers/node/updateFile");

// const excludedDirectories = ["data"];
// const target = "= require(.*)";

// // recursively rename imports
// const renameImports = async (sourcePath) => {
//   const dir = await readDir(sourcePath);
//   if (dir) {
//     for (let file of dir) {
//       // skip exludedDirectories
//       if (excludedDirectories.includes(file)) return;
//       const filePath = `${sourcePath}/${file}`;
//       // if its a ts file
//       if (file.includes(".ts")) {
//         await updateFile({ filePath, target, cb: (e) => renameImport((e, file)) });
//       } else renameImports(filePath);
//     }
//   } else console.log("\n:>> No such folder exists :>> ");
// };

// console.log("\n:>>> Starting script\n");
// renameImports("./src");
