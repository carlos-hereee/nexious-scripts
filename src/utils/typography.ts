interface PWord {
  string: string;
  current: string;
  target: string;
  casing?: "upper" | "lower" | "none";
}
interface PCasing {
  data: string;
  casing?: "upper" | "lower" | "none";
}
export const modifyCasing = ({ data, casing }: PCasing) => {
  switch (casing) {
    case "upper":
      return data.toUpperCase();
    case "lower":
      return data.toLowerCase();
    default:
      return data;
  }
};

export const replaceWord = ({ string, current, target, casing }: PWord) => {
  if (typeof string !== "string") return string;
  const data = modifyCasing({ data: target, casing });

  return string.replace(current, data);
};
export const replaceAllWords = ({ string, target, current, casing }: PWord) => {
  if (typeof string !== "string") return string;
  const data = modifyCasing({ data: target, casing });

  return string.replaceAll(current, data);
};

export const renameFileImports = (data: string, target: string) => {
  return data.replaceAll("${name}", target).replaceAll("${lowerCaseName}", target.toLowerCase());
};
