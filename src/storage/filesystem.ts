
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

import { FileTreeNode } from "../types/fileTree";

const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|gif|bmp|webp|tiff?|pdf)$/i;
const HIDDEN_DIRS = new Set(["ocr_outputs", "output", ".git", "node_modules"]);

/**
 * Recursively scan a directory and build a FileTreeNode tree.
 * Directories listed in HIDDEN_DIRS are excluded.
 * Files are checked for OCR status via a lightweight existence check.
 */
export async function scanDirectoryRecursive(
  dirHandle: FileSystemDirectoryHandle,
  rootHandle: FileSystemDirectoryHandle,
  prefix = ""
): Promise<FileTreeNode[]> {
  const dirs: FileTreeNode[] = [];
  const files: FileTreeNode[] = [];

  // Get ocr_outputs handle once at this level for status checks
  let ocrDirHandle: FileSystemDirectoryHandle | null = null;
  try {
    ocrDirHandle = await rootHandle.getDirectoryHandle("ocr_outputs");
  } catch {
    // no ocr_outputs dir yet
  }

  // @ts-ignore - values() iterator
  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind === "directory") {
      if (HIDDEN_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      const childPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const children = await scanDirectoryRecursive(entry, rootHandle, childPath);
      dirs.push({
        id: childPath,
        name: entry.name,
        kind: "directory",
        dirHandle: entry,
        children,
        ocrStatus: "none",
      });
    } else if (entry.kind === "file") {
      const file: File = await entry.getFile();
      if (file.name.startsWith(".") || !SUPPORTED_EXTENSIONS.test(file.name)) continue;

      const filePath = prefix ? `${prefix}/${file.name}` : file.name;

      // Check OCR status via lightweight existence check
      let ocrStatus: FileTreeNode["ocrStatus"] = "none";
      if (ocrDirHandle) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        try {
          await ocrDirHandle.getFileHandle(`${baseName}.ocr.json`);
          ocrStatus = "done";
        } catch {
          // not found
        }
      }

      files.push({
        id: filePath,
        name: file.name,
        kind: "file",
        file,
        ocrStatus,
      });
    }
  }

  // Sort: directories first, then alphabetically
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}
