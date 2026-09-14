// DEPRECATED: see note in File.d.ts. The named exports now live in
// `src/codegen/codegen.types.ts`. Delete this after one release cycle.
//
// New usage:
//   import type { ContextConfig, TCasing } from "@codegen/codegen.types.js";

declare module "interface-react" {
  export type TCasing = "upper" | "lower" | "none" | "camelTo_";
  export interface PWord {
    string: string;
    current: string;
    target: string;
    casing?: "upper" | "lower" | "none";
  }
  export interface ContextConfig {
    name: string;
    buildPath: string;
    state: string[];
    dispatch: string[];
    request: string[];
  }
}
