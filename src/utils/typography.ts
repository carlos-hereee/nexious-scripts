interface P {
  string: string;
  current: string;
  target: string;
}
export const replaceWord = ({ string, current, target }: P): string => {
  if (typeof string !== "string") return string;
  return string.replace(current, target);
};
// // add missing js extension
// export const addJsExt = (string: string) => {
//   return string.replace(`";`, `.js";`);
// };
// // update exports to esm
// export const exportEsm = (string: string, fileName: string) => {
//   if (typeof string === "string") {
//     const componentName = fileName.split(".ts")[0];
//     return string.replace("export", `export const ${componentName}`);
//   }
// };
// // update import esm
// export const importEsm = (string: string) => {
//   if (typeof string === "string") {
//     return string.replace("const", "import").replace("= require(", " from ").replace(")", "");
//   }
// };
// export const jsonAssert = (string: string) => {
//   return string.replace(`;`, ` assert { type: "json" };`);
// };
// export const jsonRevertAssert = (string: string) => {
//   return string.replace(`assert { type: "json" };`, `;`);
// };
