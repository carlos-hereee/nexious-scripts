export const regexPatern = {
  localPathIncludeJson: `from (?!.jsonwebtoken)(.*\.json)`,
  localPathExcludeJson: `from (?!.*json)(.*)/`,
  jsonAssert: `assert { type: \"json\" };`,
  localPath: `(.*)/`,
};
