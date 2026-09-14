// ── nexious-scripts public API ──
// What: the entry point exposed to consumers via package.json's "main" field.
// Who: any package that does `import { ... } from "nexious-scripts"`.
// Why: keeps the surface explicit. If you want something in the public API it has
//   to be re-exported here. Everything else is internal and free to change.

// Filesystem helpers, directory walking, reading, writing, config loading.
export { authorsPen } from "@fs/authorsPen.js";
export { copyFile } from "@fs/copyFile.js";
export { createFileIfNotExists } from "@fs/createFile.js";
export { loadArgs } from "@fs/loadArgs.js";
export { readFile, readDir, readConfig } from "@fs/readFile.js";
export { updateFile } from "@fs/updateFile.js";
export type { ErrorName, MessageData, IAuthorsPen, IUpdateFile, CopyFileParams } from "@fs/fs.types.js";

// Codegen, React context/reducer/request scaffolding.
export { buildContext } from "@codegen/buildContext.js";
export { buildReducer } from "@codegen/buildReducer.js";
export { buildRequest } from "@codegen/buildRequest.js";
export type { ContextConfig, TCasing, PWord } from "@codegen/codegen.types.js";

// Utilities, string and message helpers.
export { matchString } from "@utils/matchString.js";
export { generateLogMessage } from "@utils/message.js";
export { modifyCasing, renameName, renameDispatch } from "@utils/typography.js";

// Random, cross-language compatible random string generator.
export { generateRandomString, generateRandomList } from "./random/generate.js";
export type { GenerateOptions, RandomAlphabet } from "./random/generate.js";
export {
  POOL_FULL,
  POOL_SAFE,
  POOL_HEX,
  SEGMENT_LENGTH,
  DASH_THRESHOLD,
  DEFAULT_SEGMENTS,
} from "./random/charPools.js";
