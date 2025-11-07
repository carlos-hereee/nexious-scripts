interface LoadArgs {
  config: string;
  root: string;
}
export const loadArgs = (config = ""): LoadArgs => {
  // Get only the arguments passed to the script
  const scriptArgs = process.argv.slice(2);
  // // You can parse these arguments further if needed
  // // For example, to get a value from a key=value pair:
  const configFile = scriptArgs.find((arg) => arg.startsWith("config="));
  if (configFile) config = configFile.split("=")[1];
  // replace node modules to find config file
  const root = process.cwd().replace("node_modules\\nexious-scripts", "");
  return { config: root + config, root };
};
