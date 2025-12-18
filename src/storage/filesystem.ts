
/**
 * Helper to get or create a subdirectory handle.
 */
export async function getOrCreateSubdirectory(
  dirHandle: FileSystemDirectoryHandle,
  subDirName: string
): Promise<FileSystemDirectoryHandle> {
  return await dirHandle.getDirectoryHandle(subDirName, { create: true });
}

/**
 * Helper to write content to a file in a directory.
 */
export async function writeFile(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  content: Blob | string | BufferSource
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Types for File System Access API if not globally available.
 * (In modern browsers these are usually globally available, but explicit types help TS)
 */
// These interfaces are often part of the environment, but strict TS might need them if "dom" lib is not enough or specific versions.
// We rely on the global types provided by "dom" lib in tsconfig or @types/wicg-file-system-access
