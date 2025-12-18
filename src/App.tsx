import React, { useCallback, useEffect, useState } from "react";
import { requestOcrHtml } from "./lmStudioClient";
import { getPrompt } from "./ocr/prompts";
import { htmlToMarkdown } from "./ocr/htmlToMarkdown";
import { renderBboxesFromHtml } from "./ocr/renderBboxes";
import { fileToHash } from "./lib/hash";
import {
  listAllOcrResults,
  loadOcrResult,
  saveOcrResult,
  clearAllOcrResults
} from "./storage/ocrStore";
import { exportAllToDirectory, makeZipBlob } from "./export/exportAll";
import { convertPdfToJpegs, splitPdfPages, splitImage } from "./lib/pdfTools";
import { getOrCreateSubdirectory, writeFile } from "./storage/filesystem";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./components/ui/card";

type OutputFormat = "all" | "markdown_with_headers" | "markdown" | "html";

type ThemeMode = "light" | "dark" | "system";

type BatchJobStatus = "queued" | "processing" | "done" | "error";

type BatchJob = {
  id: number;
  name: string;
  status: BatchJobStatus;
  cached: boolean;
};

type GalleryItem = {
  id: string;
  name: string;
  url: string;
  fromCache: boolean;
  createdAt: number;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

// Define FileSystemDirHandle type locally if needed or assume it's global
// In this context we treat it as 'any' or rely on global availability for simplicity in the main file
// effectively letting TS check it against the dom lib.

export const App: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234");
  const [model, setModel] = useState("chandra-ocr");
  const [apiKey, setApiKey] = useState("lm-studio");
  const [systemPrompt, setSystemPrompt] = useState(getPrompt("ocr_layout"));

  // Storage / Folder Mode
  const [workDirHandle, setWorkDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [workDirFiles, setWorkDirFiles] = useState<File[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<"ocr" | "pdf_convert" | "split_pages">("ocr");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutputFormat>("all");

  const [status, setStatus] = useState("Idle");
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [htmlOutput, setHtmlOutput] = useState("");
  const [markdownWithHeaders, setMarkdownWithHeaders] = useState("");
  const [markdownNoHeaders, setMarkdownNoHeaders] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string>("");

  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchStatus, setBatchStatus] = useState("Idle");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchIsRunning, setBatchIsRunning] = useState(false);

  const [theme, setTheme] = useState<ThemeMode>("system");

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [canUseDirectoryPicker, setCanUseDirectoryPicker] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theme-mode");
    if (
      stored === "light" ||
      stored === "dark" ||
      stored === "system"
    ) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      if (mode === "light") {
        root.classList.remove("dark");
      } else if (mode === "dark") {
        root.classList.add("dark");
      } else {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        if (prefersDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    };

    applyTheme(theme);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme-mode", theme);
    }

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCanUseDirectoryPicker("showDirectoryPicker" in (window as any));
  }, []);

  const upsertGalleryItem = useCallback(
    (id: string, name: string, url: string, fromCache: boolean) => {
      setGalleryItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === id);
        const now = Date.now();
        const nextItem: GalleryItem = {
          id,
          name,
          url,
          fromCache,
          createdAt: now
        };

        if (existingIndex === -1) {
          return [nextItem, ...prev];
        }

        const next = [...prev];
        next[existingIndex] = nextItem;
        next.sort((a, b) => b.createdAt - a.createdAt);
        return next;
      });
    },
    []
  );

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus("Testing connection...");
    setError(null);
    try {
      const trimmedBase = baseUrl.replace(/\/+$/, "");
      const resp = await fetch(`${trimmedBase}/api/v0/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(
          `Models request failed with status ${resp.status}: ${text}`
        );
      }

      const data = (await resp.json()) as {
        models?: Array<{ id?: string }>;
      };
      const count = data.models?.length ?? 0;
      setConnectionStatus(
        count > 0
          ? `Connected to LM Studio. ${count} models available.`
          : "Connected to LM Studio, but no models reported."
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to connect to LM Studio";
      setConnectionStatus(null);
      setError(message);
    }
  }, [apiKey, baseUrl]);

  const handleRunOcr = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (!selectedFile) {
        setError("Please select an image file to process.");
        return;
      }

      setIsRunning(true);
      setStatus("Running OCR...");
      setHtmlOutput("");
      setMarkdownWithHeaders("");
      setMarkdownNoHeaders("");
      setAnnotatedImageUrl("");

      try {
        const hash = await fileToHash(selectedFile);

        try {
          const cached = await loadOcrResult(hash, model);
          if (cached) {
            setHtmlOutput(cached.html);
            if (format === "all" || format === "markdown_with_headers") {
              setMarkdownWithHeaders(cached.markdownWithHeaders);
            }
            if (format === "all" || format === "markdown") {
              setMarkdownNoHeaders(cached.markdownNoHeaders);
            }
            if (cached.annotatedImageDataUrl) {
              setAnnotatedImageUrl(cached.annotatedImageDataUrl);
              upsertGalleryItem(
                hash,
                selectedFile.name,
                cached.annotatedImageDataUrl,
                true
              );
            }
            setStatus("Loaded from cache");
            return;
          }
        } catch {
        }

        const imageDataUrl = await fileToDataUrl(selectedFile);

        const html = await requestOcrHtml({
          config: {
            baseUrl,
            model,
            apiKey
          },
          promptType: "ocr_layout",
          imageDataUrl,
          customSystemPrompt: systemPrompt
        });

        setHtmlOutput(html);

        let mdWith = "";
        let mdWithout = "";

        if (format === "all" || format === "markdown_with_headers") {
          mdWith = htmlToMarkdown(html, true);
          setMarkdownWithHeaders(mdWith);
        }
        if (format === "all" || format === "markdown") {
          mdWithout = htmlToMarkdown(html, false);
          setMarkdownNoHeaders(mdWithout);
        }

        let annotated: string | undefined;
        try {
          annotated = await renderBboxesFromHtml(selectedFile, html);
          setAnnotatedImageUrl(annotated);
          upsertGalleryItem(
            hash,
            selectedFile.name,
            annotated,
            false
          );
        } catch {
        }

        try {
          await saveOcrResult(hash, model, {
            imageName: selectedFile.name,
            html,
            markdownWithHeaders: mdWith || htmlToMarkdown(html, true),
            markdownNoHeaders: mdWithout || htmlToMarkdown(html, false),
            annotatedImageDataUrl: annotated
          });
        } catch {
        }

        setStatus("Completed");
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Unexpected error during OCR.";
        setError(message);
        setStatus("Error");
      } finally {
        setIsRunning(false);
      }
    },
    [apiKey, baseUrl, format, model, selectedFile, upsertGalleryItem]
  );

  const handleRunBatchOcr = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBatchError(null);

      if (!batchFiles.length) {
        setBatchError("Please select at least one image to process.");
        return;
      }

      setBatchIsRunning(true);
      setBatchStatus("Running batch OCR...");

      setBatchJobs(
        batchFiles.map((file, index) => ({
          id: index,
          name: file.name,
          status: "queued",
          cached: false
        }))
      );

      try {
        for (let i = 0; i < batchFiles.length; i += 1) {
          const file = batchFiles[i];

          setBatchJobs((prev) =>
            prev.map((job) =>
              job.id === i ? { ...job, status: "processing" } : job
            )
          );

          try {
            const hash = await fileToHash(file);

            try {
              const cached = await loadOcrResult(hash, model);
              if (cached) {
                setHtmlOutput(cached.html);
                if (format === "all" || format === "markdown_with_headers") {
                  setMarkdownWithHeaders(cached.markdownWithHeaders);
                }
                if (format === "all" || format === "markdown") {
                  setMarkdownNoHeaders(cached.markdownNoHeaders);
                }
                if (cached.annotatedImageDataUrl) {
                  setAnnotatedImageUrl(cached.annotatedImageDataUrl);
                  upsertGalleryItem(
                    hash,
                    file.name,
                    cached.annotatedImageDataUrl,
                    true
                  );
                }
                setBatchJobs((prev) =>
                  prev.map((job) =>
                    job.id === i
                      ? { ...job, status: "done", cached: true }
                      : job
                  )
                );
                continue;
              }
            } catch {
            }

            const imageDataUrl = await fileToDataUrl(file);

            const html = await requestOcrHtml({
              config: {
                baseUrl,
                model,
                apiKey
              },
              promptType: "ocr_layout",
              imageDataUrl,
              customSystemPrompt: systemPrompt
            });

            setHtmlOutput(html);

            let mdWith = "";
            let mdWithout = "";

            if (format === "all" || format === "markdown_with_headers") {
              mdWith = htmlToMarkdown(html, true);
              setMarkdownWithHeaders(mdWith);
            }
            if (format === "all" || format === "markdown") {
              mdWithout = htmlToMarkdown(html, false);
              setMarkdownNoHeaders(mdWithout);
            }

            let annotated: string | undefined;
            try {
              annotated = await renderBboxesFromHtml(file, html);
              setAnnotatedImageUrl(annotated);
              upsertGalleryItem(
                hash,
                file.name,
                annotated,
                false
              );
            } catch {
            }

            try {
              await saveOcrResult(hash, model, {
                imageName: file.name,
                html,
                markdownWithHeaders: mdWith || htmlToMarkdown(html, true),
                markdownNoHeaders: mdWithout || htmlToMarkdown(html, false),
                annotatedImageDataUrl: annotated
              });
            } catch {
            }

            setBatchJobs((prev) =>
              prev.map((job) =>
                job.id === i ? { ...job, status: "done" } : job
              )
            );
          } catch (e) {
            const message =
              e instanceof Error
                ? e.message
                : "Unexpected error during batch OCR.";
            setBatchError(message);
            setBatchJobs((prev) =>
              prev.map((job) =>
                job.id === i ? { ...job, status: "error" } : job
              )
            );
          }
        }

        setBatchStatus("Batch completed");
      } finally {
        setBatchIsRunning(false);
      }
    },
    [apiKey, baseUrl, batchFiles, format, model, upsertGalleryItem]
  );

  const handleOpenFolder = useCallback(async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setWorkDirHandle(handle);
      setConnectionStatus("Opened folder: " + handle.name);

      // List files
      const files: File[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === "file") {
          const file = await entry.getFile();
          if (!file.name.startsWith(".")) {
            files.push(file);
          }
        }
      }
      setWorkDirFiles(files.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleConvertPdf = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !workDirHandle) return;
    setStatus("Converting PDF...");
    setIsRunning(true);
    try {
      await convertPdfToJpegs(selectedFile, workDirHandle);
      setStatus("Conversion Complete! (Saved to converted_jpegs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setStatus("Error");
    } finally {
      setIsRunning(false);
    }
  }, [selectedFile, workDirHandle]);

  const handleSplitPages = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !workDirHandle) return;
    setStatus("Splitting Pages...");
    setIsRunning(true);
    try {
      if (selectedFile.type === "application/pdf") {
        await splitPdfPages(selectedFile, workDirHandle);
      } else if (selectedFile.type.startsWith("image/")) {
        await splitImage(selectedFile, workDirHandle);
      } else {
        throw new Error("Unsupported file type for splitting");
      }
      setStatus("Splitting Complete! (Saved to split_jpegs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Splitting failed");
      setStatus("Error");
    } finally {
      setIsRunning(false);
    }
  }, [selectedFile, workDirHandle]);


  const imagePreviewUrl = selectedFile
    ? URL.createObjectURL(selectedFile)
    : null;

  const handleLoadGalleryFromStorage = useCallback(async () => {
    setExportError(null);
    const results = await listAllOcrResults();
    const items: GalleryItem[] = [];
    for (const result of results) {
      if (!result.annotatedImageDataUrl) continue;
      items.push({
        id: result.key,
        name: result.imageName,
        url: result.annotatedImageDataUrl,
        fromCache: true,
        createdAt: result.createdAt
      });
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    setGalleryItems(items);
    setExportStatus(
      items.length
        ? `Loaded ${items.length} annotated images from storage.`
        : "No annotated images found in storage."
    );
  }, []);

  const handleExportToFolder = useCallback(async () => {
    setExportError(null);
    setExportStatus(null);

    if (!canUseDirectoryPicker) {
      setExportError(
        "This browser does not support selecting a target folder."
      );
      return;
    }

    setIsExporting(true);
    setExportStatus("Preparing export…");

    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const results = await listAllOcrResults();
      await exportAllToDirectory(dirHandle, results);
      setExportStatus(
        results.length
          ? `Exported ${results.length} items to the selected folder.`
          : "No OCR results found to export."
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to export to folder.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, [canUseDirectoryPicker]);

  const handleDownloadZip = useCallback(async () => {
    setExportError(null);
    setExportStatus(null);
    setIsExporting(true);
    setExportStatus("Preparing ZIP…");

    try {
      const results = await listAllOcrResults();
      const blob = await makeZipBlob(results);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ocr_outputs.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setExportStatus(
        results.length
          ? `Downloaded ${results.length} items as ZIP.`
          : "No OCR results found to include in ZIP."
      );
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to prepare ZIP archive.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleClearGalleryAndCache = useCallback(async () => {
    setExportError(null);
    setExportStatus(null);

    const confirmed = window.confirm(
      "This will clear the local OCR cache and gallery stored in your browser. This cannot be undone. Do you want to continue?"
    );
    if (!confirmed) {
      return;
    }

    setIsExporting(true);
    try {
      await clearAllOcrResults();
      setGalleryItems([]);
      setAnnotatedImageUrl("");
      setExportStatus("Cleared local OCR cache and gallery.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to clear local cache.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-black/10 backdrop-blur">
        <div className="container flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              LM Studio OCR Application
            </h1>
            <p className="text-sm text-muted-foreground">
              Run high-quality OCR against your local LM Studio vision models.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground md:items-end">
            <p className="max-w-xs md:text-right">
              Tip: Enable CORS for this app&apos;s origin in LM Studio&apos;s
              settings and ensure a vision-capable model is loaded.
            </p>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[0.7rem] uppercase tracking-wide">
                Theme
              </span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeMode)}
                className="h-7 rounded-md border border-border bg-background px-2 text-[0.7rem] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>LM Studio Connection</CardTitle>
              <CardDescription>
                Configure how the app talks to your local LM Studio instance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:1234"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="model">Model name</Label>
                  <Input
                    id="model"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="chandra-ocr"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API key</Label>
                  <Input
                    id="apiKey"
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="lm-studio"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default LM Studio key is usually <code>lm-studio</code>.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                  >
                    Test connection
                  </Button>
                  {connectionStatus && (
                    <span className="text-xs text-emerald-400">
                      {connectionStatus}
                    </span>
                  )}
                  {error && !isRunning && status !== "Error" && (
                    <span className="text-xs text-destructive">{error}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                Customize the system prompt sent to the model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="systemPrompt">Prompt content</Label>
                  <Textarea
                    id="systemPrompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="min-h-[200px] font-mono text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSystemPrompt(getPrompt("ocr_layout"))}
                >
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Single Image OCR</CardTitle>
              <CardDescription>
                Upload a document image and generate HTML and markdown outputs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workDirHandle ? (
                <div className="mb-4 p-2 bg-muted/20 rounded border border-border text-xs">
                  <p className="font-semibold">Working in: {workDirHandle.name}</p>
                  <p>Outputs will be saved to this folder.</p>
                </div>
              ) : (
                <div className="mb-4">
                  <Button onClick={handleOpenFolder} variant="outline" className="w-full">
                    📂 Open Working Folder (Required for saving to disk)
                  </Button>
                </div>
              )}

              <div className="flex gap-2 mb-4 border-b border-border/50 pb-2">
                <button
                  onClick={() => setActiveTab("ocr")}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === "ocr" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  OCR
                </button>
                <button
                  onClick={() => setActiveTab("pdf_convert")}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === "pdf_convert" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  PDF to JPEG
                </button>
                <button
                  onClick={() => setActiveTab("split_pages")}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === "split_pages" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  Split Pages
                </button>
              </div>

              {activeTab === "ocr" && (
                <form onSubmit={handleRunOcr} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="file">Input File</Label>
                    {workDirHandle ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        onChange={(e) => {
                          const file = workDirFiles.find(f => f.name === e.target.value) || null;
                          setSelectedFile(file);
                        }}
                      >
                        <option value="">Select a file from folder...</option>
                        {workDirFiles.map(f => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="file"
                        type="file"
                        accept=".png,.jpg,.jpeg,.tiff,.tif"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSelectedFile(file);
                        }}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, JPEG, or TIFF formats are supported.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="format">Output format</Label>
                    <select
                      id="format"
                      value={format}
                      onChange={(e) =>
                        setFormat(e.target.value as OutputFormat)
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="all">All (HTML + markdown)</option>
                      <option value="markdown_with_headers">
                        Markdown with headers/footers
                      </option>
                      <option value="markdown">
                        Markdown without headers/footers
                      </option>
                      <option value="html">HTML only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={isRunning || !selectedFile}
                    >
                      {isRunning ? "Processing…" : "Run OCR"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {status}
                    </span>
                  </div>

                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}

                  {imagePreviewUrl && (
                    <div className="pt-1 space-y-1.5">
                      <p className="text-xs text-muted-foreground">Preview</p>
                      <div className="overflow-hidden rounded-lg border border-border/80 bg-black/20">
                        <img
                          src={imagePreviewUrl}
                          alt="Selected input"
                          className="block max-h-64 w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </form>
              )}

              {activeTab === "pdf_convert" && (
                <form onSubmit={handleConvertPdf} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Input PDF</Label>
                    {workDirHandle ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        onChange={(e) => {
                          const file = workDirFiles.find(f => f.name === e.target.value) || null;
                          setSelectedFile(file);
                        }}
                      >
                        <option value="">Select a PDF...</option>
                        {workDirFiles.filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf")).map(f => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-yellow-500">Please select a folder first to use this feature.</div>
                    )}
                  </div>
                  <Button type="submit" disabled={!workDirHandle || !selectedFile || isRunning}>
                    {isRunning ? "Converting..." : "Convert to JPEGs"}
                  </Button>
                  <p className="text-xs text-muted-foreground">{status}</p>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </form>
              )}

              {activeTab === "split_pages" && (
                <form onSubmit={handleSplitPages} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Input File (PDF/Image)</Label>
                    {workDirHandle ? (
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        onChange={(e) => {
                          const file = workDirFiles.find(f => f.name === e.target.value) || null;
                          setSelectedFile(file);
                        }}
                      >
                        <option value="">Select a file...</option>
                        {workDirFiles.map(f => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-yellow-500">Please select a folder first to use this feature.</div>
                    )}
                  </div>
                  <Button type="submit" disabled={!workDirHandle || !selectedFile || isRunning}>
                    {isRunning ? "Splitting..." : "Split Pages"}
                  </Button>
                  <p className="text-xs text-muted-foreground">{status}</p>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </form>
              )}

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Batch OCR</CardTitle>
              <CardDescription>
                Select multiple images and process them sequentially using the
                current settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRunBatchOcr} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="batch-files">Images</Label>
                  <Input
                    id="batch-files"
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.tiff,.tif"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setBatchFiles(files);
                      setBatchJobs(
                        files.map((file, index) => ({
                          id: index,
                          name: file.name,
                          status: "queued" as BatchJobStatus,
                          cached: false
                        }))
                      );
                      setBatchStatus(files.length ? "Ready" : "Idle");
                      setBatchError(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Using output format:{" "}
                    {format === "all"
                      ? "All (HTML + markdown)"
                      : format === "markdown_with_headers"
                        ? "Markdown with headers/footers"
                        : format === "markdown"
                          ? "Markdown without headers/footers"
                          : "HTML only"}
                    .
                  </p>
                </div>

                {batchJobs.length > 0 && (
                  <div className="rounded-md border border-border/70 bg-muted/40 p-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Queue
                    </p>
                    <ul className="space-y-1 text-xs">
                      {batchJobs.map((job) => (
                        <li
                          key={job.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate max-w-[10rem]">
                            {job.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <span
                              className={
                                job.status === "done"
                                  ? "text-emerald-400"
                                  : job.status === "processing"
                                    ? "text-sky-400"
                                    : job.status === "error"
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                              }
                            >
                              {job.status}
                            </span>
                            {job.cached && (
                              <span className="rounded-full bg-amber-500/10 px-2 py-[1px] text-[0.65rem] font-medium text-amber-400">
                                cached
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={batchIsRunning || batchFiles.length === 0}
                  >
                    {batchIsRunning ? "Processing batch…" : "Run batch"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {batchStatus}
                  </span>
                </div>

                {batchError && (
                  <p className="text-xs text-destructive">{batchError}</p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Inspect and copy the raw HTML or markdown produced by the model.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-3">
              {(format === "all" || format === "html") && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    HTML
                  </h3>
                  <Textarea
                    readOnly
                    value={htmlOutput}
                    rows={10}
                    spellCheck={false}
                  />
                </div>
              )}

              {(format === "all" || format === "markdown_with_headers") && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Markdown (with headers)
                  </h3>
                  <Textarea
                    readOnly
                    value={markdownWithHeaders}
                    rows={10}
                    spellCheck={false}
                  />
                </div>
              )}

              {(format === "all" || format === "markdown") && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Markdown (no headers)
                  </h3>
                  <Textarea
                    readOnly
                    value={markdownNoHeaders}
                    rows={10}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {annotatedImageUrl && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Annotated image (bounding boxes)
                </h3>
                <div className="overflow-hidden rounded-lg border border-border/80 bg-black/5">
                  <img
                    src={annotatedImageUrl}
                    alt="Annotated OCR result with bounding boxes"
                    className="block max-h-[420px] w-full object-contain"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gallery & Export</CardTitle>
            <CardDescription>
              Browse annotated images and export all OCR outputs to a folder or
              ZIP archive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadGalleryFromStorage}
                  disabled={isExporting}
                >
                  Load gallery from storage
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportToFolder}
                  disabled={isExporting || !canUseDirectoryPicker}
                >
                  Export all to folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadZip}
                  disabled={isExporting}
                >
                  Download all as ZIP
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearGalleryAndCache}
                  disabled={isExporting}
                >
                  Clear gallery & cache
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {exportStatus}
              </div>
            </div>

            {exportError && (
              <p className="mt-1 text-xs text-destructive">{exportError}</p>
            )}

            <div className="mt-4">
              {galleryItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No annotated images yet. Run OCR or load from storage to
                  populate the gallery.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {galleryItems.map((item) => (
                    <figure
                      key={item.id}
                      className="overflow-hidden rounded-lg border border-border/70 bg-muted/40"
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="block max-h-56 w-full object-contain bg-black/10"
                      />
                      <figcaption className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground">
                        <span className="truncate max-w-[11rem]">
                          {item.name}
                        </span>
                        {item.fromCache && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-[1px] text-[0.65rem] font-medium text-amber-400">
                            cached
                          </span>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main >
    </div >
  );
};
