export type OcrStatus = "none" | "done" | "processing";

export interface FileTreeNode {
  /** Relative path from workspace root, e.g. "converted_jpegs/page_1.jpg" */
  id: string;
  /** Display name */
  name: string;
  kind: "file" | "directory";
  /** Only present for file nodes */
  file?: File;
  /** Only present for directory nodes */
  dirHandle?: FileSystemDirectoryHandle;
  /** Only present for directory nodes */
  children?: FileTreeNode[];
  /** OCR processing status (file nodes only) */
  ocrStatus: OcrStatus;
}
