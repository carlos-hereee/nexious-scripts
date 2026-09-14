import { renameName } from "@utils/typography.js";
import type { ContextConfig } from "./codegen.types.js";

// ── buildRequest ──
// What: substitutes placeholders in one line of the request template. The request
//   template is much simpler than the context/reducer templates because each request
//   file is a thin async wrapper; the only dynamic bit is the function name.

export const buildRequest = (line: string, config: ContextConfig, reqName: string): string => {
  const data = renameName(line, config.name);
  return data.replace("${requestName}", reqName + "Req");
};
