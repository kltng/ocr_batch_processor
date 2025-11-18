import React, { useCallback, useEffect, useState } from "react";
import { requestOcrHtml } from "./lmStudioClient";
import { htmlToMarkdown } from "./ocr/htmlToMarkdown";
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

export const App: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234");
  const [model, setModel] = useState("chandra-ocr");
  const [apiKey, setApiKey] = useState("lm-studio");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutputFormat>("all");

  const [status, setStatus] = useState("Idle");
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [htmlOutput, setHtmlOutput] = useState("");
  const [markdownWithHeaders, setMarkdownWithHeaders] = useState("");
  const [markdownNoHeaders, setMarkdownNoHeaders] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("system");

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

      try {
        const imageDataUrl = await fileToDataUrl(selectedFile);

        const html = await requestOcrHtml({
          config: {
            baseUrl,
            model,
            apiKey
          },
          promptType: "ocr_layout",
          imageDataUrl
        });

        setHtmlOutput(html);

        if (format === "all" || format === "markdown_with_headers") {
          setMarkdownWithHeaders(htmlToMarkdown(html, true));
        }
        if (format === "all" || format === "markdown") {
          setMarkdownNoHeaders(htmlToMarkdown(html, false));
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
    [apiKey, baseUrl, format, model, selectedFile]
  );

  const imagePreviewUrl = selectedFile
    ? URL.createObjectURL(selectedFile)
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-black/10 backdrop-blur">
        <div className="container flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              LM Studio OCR PWA
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
              <CardTitle>Single Image OCR</CardTitle>
              <CardDescription>
                Upload a document image and generate HTML and markdown outputs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRunOcr} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="file">Image file</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".png,.jpg,.jpeg,.tiff,.tif"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedFile(file);
                    }}
                  />
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
