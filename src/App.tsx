import React, { useCallback, useEffect, useState } from "react";
import { requestOcrHtml } from "./lmStudioClient";
import { getPrompt } from "./ocr/prompts";
import { htmlToMarkdown } from "./ocr/htmlToMarkdown";
import { renderBboxesFromHtml } from "./ocr/renderBboxes";
import { fileToHash } from "./lib/hash";
import { OcrStoredResult } from "./storage/ocrStore";
import { loadOcrResultFromFs, saveOcrResultToFs } from "./storage/ocrFileSystem";
import { convertPdfToJpegs, splitPdfPages, splitImage } from "./lib/pdfTools";

import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { FileSidebar } from "./components/FileSidebar";
import { DocumentViewer } from "./components/DocumentViewer";
import { ActionToolbar } from "./components/ActionToolbar";
import { SettingsDialog } from "./components/SettingsDialog";

export const App: React.FC = () => {
  // --- Config State ---
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234");
  const [model, setModel] = useState("chandra-ocr");
  const [apiKey, setApiKey] = useState("lm-studio");
  const [systemPrompt, setSystemPrompt] = useState(getPrompt("ocr_layout"));
  const [showSettings, setShowSettings] = useState(false);

  // --- Workspace State ---
  const [workDirHandle, setWorkDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fileList, setFileList] = useState<File[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Derived active file for viewing (last selected)
  const activeFile = selectedFiles.length > 0 ? selectedFiles[selectedFiles.length - 1] : null;

  const [ocrResult, setOcrResult] = useState<OcrStoredResult | null>(null);

  // --- Process State ---
  const [status, setStatus] = useState("Idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [skipExisting, setSkipExisting] = useState(false);

  // --- Handlers ---
  const refreshFileList = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const files: File[] = [];
    // @ts-ignore
    for await (const entry of (handle as any).values()) {
      if (entry.kind === "file") {
        const file = await entry.getFile();
        if (!file.name.startsWith(".")) {
          files.push(file);
        }
      }
    }
    setFileList(files.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setWorkDirHandle(handle);
      await refreshFileList(handle);
    } catch (e) {
      console.error(e);
    }
  }, [refreshFileList]);

  // When selection changes, update active viewer content
  const handleSelectionChange = useCallback(async (files: File[]) => {
    setSelectedFiles(files);

    // If we selected a single new file (or multiple), default view to the last one
    const newActive = files.length > 0 ? files[files.length - 1] : null;

    if (newActive && newActive !== activeFile) {
      setOcrResult(null); // Reset prev result
      setStatus("Idle");
      if (workDirHandle) {
        const existing = await loadOcrResultFromFs(workDirHandle, newActive.name);
        if (existing) {
          setOcrResult(existing);
          setStatus("Loaded existing result");
        }
      }
    } else if (!newActive) {
      setOcrResult(null);
      setStatus("Idle");
    }
  }, [workDirHandle, activeFile]);

  // Re-load result if active file changes specifically (e.g. from internal logic?)
  // Actually handleSelectionChange covers it.
  // But if we just opened folder and setFileList, nothing happens until selection.

  const processOneOcr = async (file: File) => {
    // Logic from handleRunOcr moved here
    const hash = await fileToHash(file);
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const html = await requestOcrHtml({
      config: { baseUrl, model, apiKey },
      promptType: "ocr_layout",
      imageDataUrl,
      customSystemPrompt: systemPrompt
    });

    const mdWith = htmlToMarkdown(html, true);
    const mdWithout = htmlToMarkdown(html, false);
    const annotated = await renderBboxesFromHtml(file, html);

    const result: OcrStoredResult = {
      key: hash,
      imageName: file.name,
      model,
      createdAt: Date.now(),
      html,
      markdownWithHeaders: mdWith,
      markdownNoHeaders: mdWithout,
      annotatedImageDataUrl: annotated
    };

    return result;
  };

  const handleRunOcr = useCallback(async () => {
    if (selectedFiles.length === 0 || !workDirHandle) return;
    setIsProcessing(true);
    setStatus("Starting Batch OCR...");

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of selectedFiles) {
      try {
        if (skipExisting) {
          const existing = await loadOcrResultFromFs(workDirHandle, file.name);
          if (existing) {
            skippedCount++;
            // If this is the active file, show it
            if (file === activeFile) {
              setOcrResult(existing);
            }
            continue;
          }
        }

        setStatus(`Processing ${file.name} (${processedCount + 1}/${selectedFiles.length - skippedCount})...`);

        const result = await processOneOcr(file);
        await saveOcrResultToFs(workDirHandle, file.name, result);

        if (file === activeFile) {
          setOcrResult(result);
        }

        processedCount++;
      } catch (e) {
        console.error(`Error processing ${file.name}`, e);
        errorCount++;
      }
    }

    setStatus(`Batch Complete. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    setIsProcessing(false);
  }, [selectedFiles, workDirHandle, baseUrl, model, apiKey, systemPrompt, skipExisting, activeFile]);

  const handleSplitPages = useCallback(async () => {
    if (selectedFiles.length === 0 || !workDirHandle) return;
    setIsProcessing(true);
    setStatus("Starting Batch Split...");

    for (const file of selectedFiles) {
      setStatus(`Splitting ${file.name}...`);
      try {
        if (file.type === "application/pdf") {
          await splitPdfPages(file, workDirHandle);
        } else {
          await splitImage(file, workDirHandle);
        }
      } catch (e) {
        console.error(e);
      }
    }

    setStatus("Batch Split Complete. Refreshing...");
    await refreshFileList(workDirHandle);
    setIsProcessing(false);
  }, [selectedFiles, workDirHandle, refreshFileList]);

  const handleConvertPdf = useCallback(async () => {
    if (selectedFiles.length === 0 || !workDirHandle) return;
    setIsProcessing(true);
    setStatus("Starting PDF Conversion...");

    for (const file of selectedFiles) {
      setStatus(`Converting ${file.name}...`);
      try {
        await convertPdfToJpegs(file, workDirHandle);
      } catch (e) {
        console.error(e);
      }
    }

    setStatus("Batch Conversion Complete. Refreshing...");
    await refreshFileList(workDirHandle);
    setIsProcessing(false);
  }, [selectedFiles, workDirHandle, refreshFileList]);


  return (
    <>
      <WorkspaceLayout
        sidebar={
          <FileSidebar
            files={fileList}
            selectedFiles={selectedFiles}
            onSelectionChange={handleSelectionChange}
            onOpenFolder={handleOpenFolder}
            hasFolder={!!workDirHandle}
          />
        }
        toolbar={
          <ActionToolbar
            isProcessing={isProcessing}
            statusMessage={status}
            onRunOcr={handleRunOcr}
            onSplitPages={handleSplitPages}
            onConvertPdf={handleConvertPdf}
            selectedCount={selectedFiles.length}
            onOpenSettings={() => setShowSettings(true)}
            skipExisting={skipExisting}
            setSkipExisting={setSkipExisting}
          />
        }
        content={
          <DocumentViewer
            file={activeFile}
            ocrResult={ocrResult}
          />
        }
      />

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        baseUrl={baseUrl}
        setBaseUrl={setBaseUrl}
        model={model}
        setModel={setModel}
        apiKey={apiKey}
        setApiKey={setApiKey}
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        defaultSystemPrompt={getPrompt("ocr_layout")}
      />
    </>
  );
};
