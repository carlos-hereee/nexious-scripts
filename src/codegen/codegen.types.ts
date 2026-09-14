// ── codegen.types ──
// What: types for the React context codegen under src/codegen/. Same modernization as
//   fs.types.ts: explicit exports instead of ambient `declare module "interface-react"`.

export type TCasing = "upper" | "lower" | "none" | "camelTo_";

export interface PWord {
  string: string;
  current: string;
  target: string;
  casing?: "upper" | "lower" | "none";
}

// Shape of a single context block in the codegen config. buildPath is the target
// directory (relative to the consuming project's root); name is the PascalCase base
// used to generate types, enums, and file names; state/dispatch/request are the
// three slot kinds the template emits.
export interface ContextConfig {
  name: string;
  buildPath: string;
  state: string[];
  dispatch: string[];
  request: string[];
}
