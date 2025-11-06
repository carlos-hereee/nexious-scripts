// const readDir = require("./helpers/node/readDir");
// const renameExport = require("./helpers/node/renameExport");
// const updateFile = require("./helpers/node/updateFile");

// const target = `export = async`;

// // recursively rename imports
// const renameExports = async (sourcePath, excludedDirectories) => {
//   const dir = await readDir(sourcePath);
//   if (dir) {
//     for (let file of dir) {
//       // skip exludedDirectories
//       if (excludedDirectories.includes(file)) return;
//       const filePath = `${sourcePath}/${file}`;
//       // if its a ts file
//       if (file.includes(".ts")) {
//         await updateFile({ filePath, target, cb: (e) => renameExport(e, file) });
//         // console.log(`Made changes to ${file}`);
//       } else if (!file.includes(".ts")) renameExports(filePath);
//     }
//   } else console.log("\n:>> No such folder exists :>> ");
// };

// console.log("\n:>>> Starting script\n");
// await renameExports("./src", ["data"]);
