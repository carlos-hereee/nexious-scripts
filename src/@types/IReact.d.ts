declare module "interface-react" {
  export interface ContextConfig {
    name: string;
    buildPath: string;
    state: string[];
    dispatch: string[];
    request: string[];
  }
}
