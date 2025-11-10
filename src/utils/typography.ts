import { TCasing } from "interface-react";

export const modifyCasing = (data: string, casing: TCasing) => {
  switch (casing) {
    case "upper":
      return data.toUpperCase();
    case "lower":
      return data.toLowerCase();
    case "camelTo_":
      return data.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
    default:
      return data;
  }
};

export const renameName = (data: string, target: string) => {
  return data
    .replaceAll("${name}", target)
    .replaceAll("${nameLower}", modifyCasing(target, "lower"))
    .replaceAll("${nameUpper}", modifyCasing(target, "upper"));
};
export const renameDispatch = (name: string, target: string) => {
  return `A_${modifyCasing(name, "upper")}.${modifyCasing(target, "camelTo_")}`;
};
