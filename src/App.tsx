import React, { useCallback, useEffect, useState } from "react";
import { requestOcrHtml } from "./lmStudioClient";
import { requestGeminiOcr } from "./geminiClient";
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
import { SettingsDialog, OcrProvider } from "./components/SettingsDialog";
import { InstructionsPage } from "./components/InstructionsPage";

export const App: React.FC = () => {
  // --- Config State ---
  const [provider, setProvider] = useState<OcrProvider>("lmstudio");

  // LM Studio Config
  const [lmBaseUrl, setLmBaseUrl] = useState("http://localhost:1234");
  const [lmModel, setLmModel] = useState("chandra-ocr");
  const [lmApiKey, setLmApiKey] = useState("lm-studio");

  // Google Config
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleModel, setGoogleModel] = useState("gemini-2.5-flash");

  // Shared
  const [systemPrompt, setSystemPrompt] = useState(getPrompt("ocr_layout"));
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

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


  const processOneOcr = async (file: File) => {
    const hash = await fileToHash(file);
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    let html = "";
    let usedModel = "";

    if (provider === "lmstudio") {
      usedModel = lmModel;
      html = await requestOcrHtml({
        config: { baseUrl: lmBaseUrl, model: lmModel, apiKey: lmApiKey },
        promptType: "ocr_layout",
        imageDataUrl,
        customSystemPrompt: systemPrompt
      });
    } else {
      // Google
      usedModel = googleModel;
      html = await requestGeminiOcr({
        config: { apiKey: googleApiKey, model: googleModel },
        promptType: "ocr_layout",
        imageDataUrl,
        customSystemPrompt: systemPrompt
      });
    }

    const mdWith = htmlToMarkdown(html, true);
    const mdWithout = htmlToMarkdown(html, false);
    const annotated = await renderBboxesFromHtml(file, html);

    const result: OcrStoredResult = {
      key: hash,
      imageName: file.name,
      model: usedModel,
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

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      try {
        // Check Skip
        if (skipExisting) {
          const existing = await loadOcrResultFromFs(workDirHandle, file.name);
          if (existing) {
            skippedCount++;
            if (file === activeFile) {
              setOcrResult(existing);
            }
            continue;
          }
        }

        // Rate Limiting for Google - 5 RPM = 1 request per 12 seconds
        // We apply delay BEFORE request, but only if it's not the very first request of the batch (or maybe always if we want to be safe considering prev batches?)
        // Safest: always wait 12s between calls.
        if (provider === "google" && i > 0 && processedCount > 0) {
          // Wait 12 seconds
          for (let s = 12; s > 0; s--) {
            setStatus(`Rate limit: Waiting ${s}s...`);
            await new Promise(r => setTimeout(r, 1000));
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
        setStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
        // Wait a bit on error to read it, then continue? Or just count error.
        errorCount++;
      }
    }

    setStatus(`Batch Complete. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
    setIsProcessing(false);
  }, [selectedFiles, workDirHandle, provider, lmBaseUrl, lmModel, lmApiKey, googleApiKey, googleModel, systemPrompt, skipExisting, activeFile]);

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
            onOpenHelp={() => setShowInstructions(true)}
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

        provider={provider}
        setProvider={setProvider}

        baseUrl={lmBaseUrl}
        setBaseUrl={setLmBaseUrl}
        lmModel={lmModel}
        setLmModel={setLmModel}
        lmApiKey={lmApiKey}
        setLmApiKey={setLmApiKey}

        googleApiKey={googleApiKey}
        setGoogleApiKey={setGoogleApiKey}
        googleModel={googleModel}
        setGoogleModel={setGoogleModel}

        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        defaultSystemPrompt={getPrompt("ocr_layout")}
      />

      <InstructionsPage
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </>
  );
};
