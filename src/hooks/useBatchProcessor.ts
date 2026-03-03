import { useState, useCallback, useRef } from "react";
import { OcrStoredResult } from "../storage/ocrStore";
import { loadOcrResultFromFs, saveOcrResultToFs } from "../storage/ocrFileSystem";
import { FileTreeNode } from "../types/fileTree";

export interface BatchProgress {
  total: number;
  completed: number;
  skipped: number;
  errors: number;
  currentFile: string;
  isRunning: boolean;
}

interface BatchProcessorOptions {
  workDirHandle: FileSystemDirectoryHandle | null;
  skipExisting: boolean;
  provider: string;
  processOneOcr: (file: File) => Promise<OcrStoredResult>;
  onFileProcessed?: (nodeId: string, result: OcrStoredResult) => void;
  onBatchComplete?: () => void;
  /** Rate limiting delay in ms between requests (e.g. 12000 for Google) */
  rateLimitMs?: number;
}

const EMPTY_PROGRESS: BatchProgress = {
  total: 0,
  completed: 0,
  skipped: 0,
  errors: 0,
  currentFile: "",
  isRunning: false,
};

export function useBatchProcessor(options: BatchProcessorOptions) {
  const {
    workDirHandle,
    skipExisting,
    provider,
    processOneOcr,
    onFileProcessed,
    onBatchComplete,
  } = options;

  const [progress, setProgress] = useState<BatchProgress>(EMPTY_PROGRESS);
  const abortRef = useRef<AbortController | null>(null);

  const runBatch = useCallback(
    async (files: { id: string; file: File }[]) => {
      if (!workDirHandle || files.length === 0) return;

      const controller = new AbortController();
      abortRef.current = controller;

      setProgress({
        total: files.length,
        completed: 0,
        skipped: 0,
        errors: 0,
        currentFile: "",
        isRunning: true,
      });

      let completed = 0;
      let skipped = 0;
      let errors = 0;
      let processedSoFar = 0;

      for (let i = 0; i < files.length; i++) {
        if (controller.signal.aborted) break;

        const { id, file } = files[i];

        try {
          // Check skip
          if (skipExisting) {
            const existing = await loadOcrResultFromFs(workDirHandle, file.name);
            if (existing) {
              skipped++;
              setProgress((p) => ({
                ...p,
                skipped,
                currentFile: `Skipped ${file.name}`,
              }));
              onFileProcessed?.(id, existing);
              continue;
            }
          }

          // Rate limiting for Google
          if (provider === "google" && processedSoFar > 0) {
            for (let s = 12; s > 0; s--) {
              if (controller.signal.aborted) break;
              setProgress((p) => ({
                ...p,
                currentFile: `Rate limit: ${s}s...`,
              }));
              await new Promise((r) => setTimeout(r, 1000));
            }
          }

          if (controller.signal.aborted) break;

          setProgress((p) => ({
            ...p,
            currentFile: file.name,
          }));

          const result = await processOneOcr(file);
          await saveOcrResultToFs(workDirHandle, file.name, result);
          completed++;
          processedSoFar++;
          setProgress((p) => ({ ...p, completed }));
          onFileProcessed?.(id, result);
        } catch (e) {
          console.error(`Error processing ${file.name}`, e);
          errors++;
          setProgress((p) => ({
            ...p,
            errors,
            currentFile: `Error: ${file.name}`,
          }));
        }
      }

      setProgress((p) => ({
        ...p,
        isRunning: false,
        currentFile: controller.signal.aborted
          ? "Cancelled"
          : `Done: ${completed} processed, ${skipped} skipped, ${errors} errors`,
      }));

      abortRef.current = null;
      onBatchComplete?.();
    },
    [workDirHandle, skipExisting, provider, processOneOcr, onFileProcessed, onBatchComplete]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { progress, runBatch, cancel };
}
