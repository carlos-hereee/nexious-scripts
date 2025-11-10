import regex from "@data/regex.json" with { type: "json" };
import { PCasing, PWord } from "interface-react";

export const modifyCasing = ({ data, casing }: PCasing) => {
  switch (casing) {
    case "upper":
      return data.toUpperCase();
    case "lower":
      return data.toLowerCase();
    case "camelTo_":
      return data.replace(regex.camelCaseToUnderscore, "$1_$2").toUpperCase();
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
export const renameDispatch = (name: string, target: string) => {
  return `A_${name.toUpperCase()}.${modifyCasing({ data: target, casing: "camelTo_" })}`;
};
