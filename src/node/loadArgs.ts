interface LoadArgs {
  config?: string;
  root?: string;
}
// TODO: BUNDLER PATHS
export const loadArgs = ({ config = "", root = "" }: LoadArgs) => {
  // const args = { config: "" };
  console.log("All arguments:", process.argv);

  const scriptArgs = process.argv.slice(2); // Get only the arguments passed to the script
  // console.log("Script-specific arguments:", scriptArgs);

  // // You can parse these arguments further if needed
  // // For example, to get a value from a key=value pair:
  const configFile = scriptArgs.find((arg) => arg.startsWith("config="));
  if (configFile) config = configFile.split("=")[1];
  return { config, root };
};
