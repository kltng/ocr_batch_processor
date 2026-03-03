import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestOcrHtml } from "./lmStudioClient";
import { requestGeminiOcr } from "./geminiClient";
import { requestOllamaOcr } from "./ollamaClient";
import { getPromptByProfile, getProfilePrompt } from "./ocr/prompts";
import { htmlToMarkdown } from "./ocr/htmlToMarkdown";
import { renderBboxesFromHtml } from "./ocr/renderBboxes";
import { fileToHash } from "./lib/hash";
import { OcrStoredResult } from "./storage/ocrStore";
import { loadOcrResultFromFs } from "./storage/ocrFileSystem";
import { convertPdfToJpegs, splitPdfPages, splitImage, SplitOrder } from "./lib/pdfTools";

import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { FileSidebar } from "./components/FileSidebar";
import { DocumentViewer } from "./components/DocumentViewer";
import { ActionToolbar } from "./components/ActionToolbar";
import { SettingsDialog, OcrProvider } from "./components/SettingsDialog";
import { InstructionsPage } from "./components/InstructionsPage";

import { useFileTree, flattenFileIds } from "./hooks/useFileTree";
import { useResizablePanel } from "./hooks/useResizablePanel";
import { useBatchProcessor } from "./hooks/useBatchProcessor";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { FileTreeNode } from "./types/fileTree";

function checkIsDeployedWithLocalProvider(): boolean {
  if (typeof window === "undefined") return false;
  const isHttps = window.location.protocol === "https:";
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isHttps && !isLocalhost;
}

/** Flatten all file nodes from a tree in display order */
function flattenFileNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") result.push(node);
    if (node.children) result.push(...flattenFileNodes(node.children));
  }
  return result;
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

  // Prompt Profile
  const [promptProfile, setPromptProfile] = useState<string>("glm_ocr_layout");

  // Shared
  const [systemPrompt, setSystemPrompt] = useState(getPromptByProfile("glm_ocr_layout"));
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // --- Workspace State ---
  const [workDirHandle, setWorkDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Selection is now a Set of node IDs (relative paths)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [ocrResult, setOcrResult] = useState<OcrStoredResult | null>(null);

  // Track the latest selection to prevent race conditions
  const selectionIdRef = useRef(0);

  // Sync systemPrompt with promptProfile
  useEffect(() => {
    setSystemPrompt(getProfilePrompt(promptProfile));
  }, [promptProfile]);

  // --- Process State ---
  const [skipExisting, setSkipExisting] = useState(false);
  const [splitOrder, setSplitOrder] = useState<SplitOrder>("LR");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Hooks ---
  const fileTree = useFileTree(workDirHandle);
  const { width: sidebarWidth, onMouseDown: onResizeMouseDown } = useResizablePanel();

  // All file nodes in display order (for navigation)
  const allFileNodes = useMemo(() => flattenFileNodes(fileTree.tree), [fileTree.tree]);

  // Build a lookup map from id → FileTreeNode
  const nodeMap = useMemo(() => {
    const map = new Map<string, FileTreeNode>();
    function walk(nodes: FileTreeNode[]) {
      for (const n of nodes) {
        map.set(n.id, n);
        if (n.children) walk(n.children);
      }
    }
    walk(fileTree.tree);
    return map;
  }, [fileTree.tree]);

  // Derived active node (last selected file)
  const activeNodeId = useMemo(() => {
    if (selectedIds.size === 0) return null;
    // Return the last ID in the set (insertion order)
    let last: string | null = null;
    selectedIds.forEach((id) => { last = id; });
    return last;
  }, [selectedIds]);

  const activeNode = activeNodeId ? nodeMap.get(activeNodeId) ?? null : null;
  const activeFile = activeNode?.file ?? null;

  // Prev/next navigation
  const activeFileIndex = activeNodeId ? allFileNodes.findIndex((n) => n.id === activeNodeId) : -1;
  const hasPrev = activeFileIndex > 0;
  const hasNext = activeFileIndex >= 0 && activeFileIndex < allFileNodes.length - 1;

  const navigatePrev = useCallback(() => {
    if (!hasPrev) return;
    const prevNode = allFileNodes[activeFileIndex - 1];
    setSelectedIds(new Set([prevNode.id]));
  }, [hasPrev, allFileNodes, activeFileIndex]);

  const navigateNext = useCallback(() => {
    if (!hasNext) return;
    const nextNode = allFileNodes[activeFileIndex + 1];
    setSelectedIds(new Set([nextNode.id]));
  }, [hasNext, allFileNodes, activeFileIndex]);

  // --- Load OCR result when selection changes ---
  useEffect(() => {
    const currentSelectionId = ++selectionIdRef.current;

    if (!activeFile || !workDirHandle) {
      setOcrResult(null);
      return;
    }

    setOcrResult(null);

    (async () => {
      const existing = await loadOcrResultFromFs(workDirHandle, activeFile.name);
      if (existing && selectionIdRef.current === currentSelectionId) {
        setOcrResult(existing);
      }
    })();
  }, [activeNodeId, workDirHandle]);

  // --- OCR Processing ---
  const processOneOcr = useCallback(async (file: File) => {
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
  }, [provider, lmBaseUrl, lmModel, lmApiKey, googleApiKey, googleModel, ollamaBaseUrl, ollamaModel, systemPrompt]);

  const handleFileProcessed = useCallback((nodeId: string, result: OcrStoredResult) => {
    fileTree.setNodeOcrStatus(nodeId, "done");
    // Update viewer if this is the active file
    if (nodeId === activeNodeId) {
      setOcrResult(result);
    }
  }, [activeNodeId, fileTree.setNodeOcrStatus]);

  const handleBatchComplete = useCallback(() => {
    setIsProcessing(false);
    // Refresh tree to get updated OCR status
    fileTree.refresh();
  }, [fileTree.refresh]);

  const { progress, runBatch, cancel: cancelBatch } = useBatchProcessor({
    workDirHandle,
    skipExisting,
    provider,
    processOneOcr,
    onFileProcessed: handleFileProcessed,
    onBatchComplete: handleBatchComplete,
  });

  // --- Handlers ---
  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();

      const handleWithPermission = handle as FileSystemDirectoryHandle & {
        requestPermission: (opts: { mode: string }) => Promise<PermissionState>;
      };
      const permission = await handleWithPermission.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        return;
      }

      setWorkDirHandle(handle);
      setSelectedIds(new Set());
      setOcrResult(null);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Scan directory when workspace handle changes
  useEffect(() => {
    if (workDirHandle) {
      fileTree.refresh();
    }
  }, [workDirHandle]);

  const handleRunOcr = useCallback(async () => {
    if (selectedIds.size === 0 || !workDirHandle) return;

    // Build file list from selected IDs
    const files: { id: string; file: File }[] = [];
    selectedIds.forEach((id) => {
      const node = nodeMap.get(id);
      if (node?.file) {
        files.push({ id: node.id, file: node.file });
        fileTree.setNodeOcrStatus(id, "processing");
      }
    });

    if (files.length === 0) return;
    setIsProcessing(true);
    await runBatch(files);
  }, [selectedIds, workDirHandle, nodeMap, runBatch, fileTree.setNodeOcrStatus]);

  const handleSplitPages = useCallback(async () => {
    if (selectedIds.size === 0 || !workDirHandle) return;
    setIsProcessing(true);

    for (const id of selectedIds) {
      const node = nodeMap.get(id);
      if (!node?.file) continue;
      try {
        if (node.file.type === "application/pdf") {
          await splitPdfPages(node.file, workDirHandle, splitOrder);
        } else {
          await splitImage(node.file, workDirHandle, splitOrder);
        }
      } catch (e) {
        console.error(e);
      }
    }

    await fileTree.refresh(["split_jpegs"]);
    setIsProcessing(false);
  }, [selectedIds, workDirHandle, nodeMap, fileTree.refresh, splitOrder]);

  const handleConvertPdf = useCallback(async () => {
    if (selectedIds.size === 0 || !workDirHandle) return;
    setIsProcessing(true);

    for (const id of selectedIds) {
      const node = nodeMap.get(id);
      if (!node?.file) continue;
      try {
        await convertPdfToJpegs(node.file, workDirHandle);
      } catch (e) {
        console.error(e);
      }
    }

    await fileTree.refresh(["converted_jpegs"]);
    setIsProcessing(false);
  }, [selectedIds, workDirHandle, nodeMap, fileTree.refresh]);

  // --- Keyboard Shortcuts ---
  const shortcutActions = useMemo(() => ({
    onSelectAll: () => {
      const allIds = flattenFileIds(fileTree.tree);
      setSelectedIds(new Set(allIds));
    },
    onDeselectAll: () => {
      setSelectedIds(new Set());
    },
    onPrevFile: navigatePrev,
    onNextFile: navigateNext,
    onRunOcr: () => {
      if (!isProcessing && selectedIds.size > 0) {
        handleRunOcr();
      }
    },
  }), [fileTree.tree, navigatePrev, navigateNext, isProcessing, selectedIds, handleRunOcr]);

  useKeyboardShortcuts(shortcutActions);

  return (
    <>
      {showHttpsWarning && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 px-4 py-3 text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Warning:</span>
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
        sidebarWidth={sidebarWidth}
        onResizeMouseDown={onResizeMouseDown}
        sidebar={
          <FileSidebar
            tree={fileTree.filteredTree}
            expandedDirs={fileTree.expandedDirs}
            onToggleDir={fileTree.toggleDir}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            searchQuery={fileTree.searchQuery}
            onSearchChange={fileTree.setSearchQuery}
            onCollapseAll={fileTree.collapseAll}
            totalFileCount={fileTree.totalFileCount}
            onOpenFolder={handleOpenFolder}
            hasFolder={!!workDirHandle}
          />
        }
        toolbar={
          <ActionToolbar
            isProcessing={isProcessing}
            progress={progress}
            onRunOcr={handleRunOcr}
            onSplitPages={handleSplitPages}
            onConvertPdf={handleConvertPdf}
            onCancelBatch={cancelBatch}
            selectedCount={selectedIds.size}
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
            onPrev={navigatePrev}
            onNext={navigateNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
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

        promptProfile={promptProfile}
        setPromptProfile={setPromptProfile}

        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        defaultSystemPrompt={getProfilePrompt(promptProfile)}
      />

      <InstructionsPage
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </>
  );
};
