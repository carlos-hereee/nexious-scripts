import { renameName } from "@utils/typography.js";
import { ContextConfig } from "interface-react";

export const buildRequest = (line: string, config: ContextConfig, reqName: string) => {
  const data = renameName(line, config.name);
  return data.replace("${requestName}", reqName + "Req");
};
