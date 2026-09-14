import fs from "fs/promises";

// ── createFileIfNotExists ──
// What: ensures a directory exists, then either creates the file with content or
//   overwrites an existing file. Despite the name, the current behavior is "create
//   or overwrite," which matches how the codegen uses it (idempotent re-generation).
// Who: called by codegen scripts that emit context files.
// When: safe to call repeatedly. The mkdir is { recursive: true } so concurrent
//   calls do not race.
// How: mkdir then writeFile. A separate access() check is not useful here because
//   fs.writeFile already truncates-or-creates.

export const createFileIfNotExists = async (currentDir: string, filePath: string, content = ""): Promise<void> => {
  await fs.mkdir(currentDir, { recursive: true });
  await fs.writeFile(filePath, content);
};
