// add missing js extension
export const addJsExt = (string) => {
  return string.replace(`";`, `.js";`);
};
// update exports to esm
export const exportEsm = (string, fileName) => {
  if (typeof string === "string") {
    const componentName = fileName.split(".ts")[0];
    return string.replace("export", `export const ${componentName}`);
  }
};
// update import esm
export const importEsm = (string) => {
  if (typeof string === "string") {
    return string.replace("const", "import").replace("= require(", " from ").replace(")", "");
  }
};
export const jsonAssert = (string) => {
  return string.replace(`;`, ` assert { type: "json" };`);
};
export const jsonRevertAssert = (string) => {
  return string.replace(`assert { type: "json" };`, `;`);
};
