import path from "path";

interface LoadArgs {
  config: string;
  root: string;
}

// ── loadArgs ──
// What: resolves the consumer-supplied config path against the project root.
// Who: used by readConfig in readFile.ts to locate the JSON config a script is run
//   against. Consumer passes config via `node dist/script.js config=./my.config.json`.
// When: once at the start of a script invocation.
// How: ① scan process.argv for "config=<path>"; ② compute the consumer's project
//   root by stripping any "node_modules/nexious-scripts" segment from process.cwd().
//   Uses path.sep so it works on Windows and POSIX, the old implementation hard-
//   coded Windows-style double backslashes and broke on macOS/Linux.

export const loadArgs = (defaultConfig = ""): LoadArgs => {
  const scriptArgs = process.argv.slice(2);
  const configFlag = scriptArgs.find((arg) => arg.startsWith("config="));
  const config = configFlag ? configFlag.split("=")[1] : defaultConfig;

  // Build the segment to strip with path.sep so both "node_modules/nexious-scripts"
  // (POSIX) and "node_modules\nexious-scripts" (Windows) match. This is what lets
  // the library work the same when installed as a dependency.
  const nodeModulesSegment = ["node_modules", "nexious-scripts"].join(path.sep);
  const root = process.cwd().replace(nodeModulesSegment, "");

  return { config: path.join(root, config), root };
};
