export const matchString = (text, pattern) => {
  // Convert wildcard pattern to a regular expression pattern
  const regexPattern = new RegExp(pattern);
  // Test if the text matches the regular expression pattern
  return regexPattern.test(text);
};
