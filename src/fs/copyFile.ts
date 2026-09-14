import { copyFile as cp } from "fs/promises";

// ── copyFile ──
// What: promise-based file copy. Replaces the old callback-style implementation so
//   the whole fs/ module uses one error protocol (thrown errors / awaited promises).
// Who: any script that needs to duplicate a file.
// How: just forwards to fs/promises.copyFile. Kept as a named wrapper so the module
//   surface is stable even if we switch the underlying call later (e.g. to a
//   permission-preserving copy).

export const copyFile = async (filePath: string, destinationPath: string): Promise<void> => {
  try {
    await cp(filePath, destinationPath);
  } catch (err) {
    // Surface the path context so the error message is useful in a script log.
    throw new Error(`copyFile failed (${filePath} -> ${destinationPath}): ${(err as Error).message}`);
  }
};
