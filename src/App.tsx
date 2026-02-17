import React, { useCallback, useEffect, useState } from "react";
import { requestOcrHtml } from "./lmStudioClient";
import { requestGeminiOcr } from "./geminiClient";
import { requestOllamaOcr } from "./ollamaClient";
import { getPrompt } from "./ocr/prompts";
import { htmlToMarkdown } from "./ocr/htmlToMarkdown";
import { renderBboxesFromHtml } from "./ocr/renderBboxes";
import { fileToHash } from "./lib/hash";
import { OcrStoredResult } from "./storage/ocrStore";
import { loadOcrResultFromFs, saveOcrResultToFs } from "./storage/ocrFileSystem";
import { convertPdfToJpegs, splitPdfPages, splitImage, SplitOrder } from "./lib/pdfTools";

import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { FileSidebar } from "./components/FileSidebar";
import { DocumentViewer } from "./components/DocumentViewer";
import { ActionToolbar } from "./components/ActionToolbar";
import { SettingsDialog, OcrProvider } from "./components/SettingsDialog";
import { InstructionsPage } from "./components/InstructionsPage";

function checkIsDeployedWithLocalProvider(): boolean {
  if (typeof window === "undefined") return false;
  const isHttps = window.location.protocol === "https:";
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isHttps && !isLocalhost;
}

export const App: React.FC = () => {
  const [showHttpsWarning, setShowHttpsWarning] = useState(false);

  useEffect(() => {
    setShowHttpsWarning(checkIsDeployedWithLocalProvider());
  }, []);
  // --- Config State ---
  const [provider, setProvider] = useState<OcrProvider>("ollama");

  // LM Studio Config
  const [lmBaseUrl, setLmBaseUrl] = useState("http://localhost:1234");
  const [lmModel, setLmModel] = useState("chandra-ocr");
  const [lmApiKey, setLmApiKey] = useState("lm-studio");

  // Google Config
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleModel, setGoogleModel] = useState("gemini-2.5-flash");

  // Ollama Config
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("glm-ocr");

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
  const [splitOrder, setSplitOrder] = useState<SplitOrder>("LR");

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

    // Compare by file name instead of object identity for reliable detection
    const isNewFile = newActive && (!activeFile || newActive.name !== activeFile.name);

    if (isNewFile) {
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
    } else if (provider === "google") {
      usedModel = googleModel;
      html = await requestGeminiOcr({
        config: { apiKey: googleApiKey, model: googleModel },
        promptType: "ocr_layout",
        imageDataUrl,
        customSystemPrompt: systemPrompt
      });
    } else if (provider === "ollama") {
      usedModel = ollamaModel;
      html = await requestOllamaOcr({
        config: { baseUrl: ollamaBaseUrl, model: ollamaModel },
        promptType: "ocr_layout",
        imageDataUrl,
        customSystemPrompt: systemPrompt
      });
    } else {
      throw new Error(`Unknown provider: ${provider}`);
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
            // Compare by file name instead of object identity
            if (activeFile && file.name === activeFile.name) {
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

        // Compare by file name instead of object identity to ensure UI updates
        if (activeFile && file.name === activeFile.name) {
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
  }, [selectedFiles, workDirHandle, provider, lmBaseUrl, lmModel, lmApiKey, googleApiKey, googleModel, ollamaBaseUrl, ollamaModel, systemPrompt, skipExisting, activeFile]);

  const handleSplitPages = useCallback(async () => {
    if (selectedFiles.length === 0 || !workDirHandle) return;
    setIsProcessing(true);
    setStatus("Starting Batch Split...");

    for (const file of selectedFiles) {
      setStatus(`Splitting ${file.name}...`);
      try {
        if (file.type === "application/pdf") {
          await splitPdfPages(file, workDirHandle, splitOrder);
        } else {
          await splitImage(file, workDirHandle, splitOrder);
        }
      } catch (e) {
        console.error(e);
      }
    }

    setStatus("Batch Split Complete. Refreshing...");
    await refreshFileList(workDirHandle);
    setIsProcessing(false);
  }, [selectedFiles, workDirHandle, refreshFileList, splitOrder]);

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
      {showHttpsWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-3 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>
              <strong>Local OCR unavailable:</strong> You're viewing the deployed app via HTTPS. 
              Local providers (LM Studio, Ollama) require running locally. 
              <a href="https://github.com/kltng/ocr_batch_processor#local-development" target="_blank" rel="noreferrer" className="underline ml-1">
                Run locally
              </a> or use Google Gemini.
            </span>
          </div>
          <button 
            onClick={() => setShowHttpsWarning(false)} 
            className="ml-4 px-2 py-1 hover:bg-amber-600 rounded text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
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
            splitOrder={splitOrder}
            setSplitOrder={setSplitOrder}
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

        ollamaBaseUrl={ollamaBaseUrl}
        setOllamaBaseUrl={setOllamaBaseUrl}
        ollamaModel={ollamaModel}
        setOllamaModel={setOllamaModel}

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
