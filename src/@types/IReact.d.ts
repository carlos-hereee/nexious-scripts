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
