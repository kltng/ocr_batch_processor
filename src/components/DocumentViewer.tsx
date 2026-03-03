import React, { useEffect, useState } from "react";
import { OcrStoredResult } from "../storage/ocrStore";
import { cn } from "../lib/utils";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "./ui/button";

type ViewMode = "split" | "original" | "annotated" | "text";

interface DocumentViewerProps {
    file: File | null;
    ocrResult: OcrStoredResult | null;
    className?: string;
    onPrev?: () => void;
    onNext?: () => void;
    hasPrev?: boolean;
    hasNext?: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
    file,
    ocrResult,
    className,
    onPrev,
    onNext,
    hasPrev = false,
    hasNext = false,
}) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("split");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (file) {
            if (file.type.startsWith("image/")) {
                const url = URL.createObjectURL(file);
                setObjectUrl(url);
                return () => URL.revokeObjectURL(url);
            } else {
                setObjectUrl(null);
            }
        } else {
            setObjectUrl(null);
        }
    }, [file]);

    // Reset view mode when file changes
    useEffect(() => {
        setViewMode("split");
        setCopied(false);
    }, [file?.name]);

    if (!file) {
        return (
            <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
                <p>No file selected</p>
            </div>
        );
    }

    const hasAnnotation = !!ocrResult?.annotatedImageDataUrl;
    const hasText = !!ocrResult?.markdownNoHeaders || !!ocrResult?.html;

    const handleCopy = async () => {
        const text = ocrResult?.markdownNoHeaders || ocrResult?.html || "";
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const viewModes: { key: ViewMode; label: string; show: boolean }[] = [
        { key: "split", label: "Split", show: true },
        { key: "original", label: "Original", show: true },
        { key: "annotated", label: "Annotated", show: hasAnnotation },
        { key: "text", label: "Markdown", show: hasText },
    ];

    return (
        <div className={cn("flex flex-col h-full overflow-hidden", className)}>
            {/* Viewer Toolbar */}
            <div className="h-10 border-b flex items-center justify-between px-4 bg-muted/20 gap-2">
                <div className="flex items-center gap-1 min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={onPrev}
                        disabled={!hasPrev}
                        title="Previous file"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={onNext}
                        disabled={!hasNext}
                        title="Next file"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs font-medium truncate ml-1">{file.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex bg-muted rounded-md p-0.5">
                        {viewModes
                            .filter((m) => m.show)
                            .map((m) => (
                                <button
                                    key={m.key}
                                    onClick={() => setViewMode(m.key)}
                                    className={cn(
                                        "px-2 py-0.5 text-[0.65rem] rounded-sm",
                                        viewMode === m.key
                                            ? "bg-white shadow text-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {m.label}
                                </button>
                            ))}
                    </div>
                    {hasText && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={handleCopy}
                            title="Copy text to clipboard"
                        >
                            {copied ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                                <Copy className="w-3 h-3" />
                            )}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {viewMode === "split" ? (
                    <div className="flex h-full w-full">
                        <div className={cn("h-full overflow-auto bg-muted/5 flex items-center justify-center p-4", hasAnnotation ? "w-1/2 border-r" : "w-full")}>
                            {objectUrl && (
                                <img src={objectUrl} alt="Original" className="max-h-full max-w-full object-contain shadow-sm" />
                            )}
                            {file.type === "application/pdf" && !objectUrl && (
                                <div className="text-center text-muted-foreground">
                                    <p className="text-4xl mb-2">PDF</p>
                                    <p className="text-sm">PDF Preview</p>
                                    <p className="text-xs mt-1">Convert to images to view pages.</p>
                                </div>
                            )}
                        </div>
                        {hasAnnotation && (
                            <div className="w-1/2 h-full overflow-auto bg-muted/5 flex items-center justify-center p-4">
                                <img src={ocrResult!.annotatedImageDataUrl} alt="Annotated" className="max-h-full max-w-full object-contain shadow-sm" />
                            </div>
                        )}
                    </div>
                ) : viewMode === "original" ? (
                    <div className="h-full overflow-auto bg-muted/5 flex items-center justify-center p-4">
                        {objectUrl && (
                            <img src={objectUrl} alt="Original" className="max-h-full max-w-full object-contain shadow-sm" />
                        )}
                        {file.type === "application/pdf" && !objectUrl && (
                            <div className="text-center text-muted-foreground">
                                <p className="text-4xl mb-2">PDF</p>
                                <p className="text-sm">PDF Preview</p>
                                <p className="text-xs mt-1">Convert to images to view pages.</p>
                            </div>
                        )}
                    </div>
                ) : viewMode === "annotated" ? (
                    <div className="h-full overflow-auto bg-muted/5 flex items-center justify-center p-4">
                        {hasAnnotation && (
                            <img src={ocrResult!.annotatedImageDataUrl} alt="Annotated" className="max-h-full max-w-full object-contain shadow-sm" />
                        )}
                    </div>
                ) : (
                    <div className="h-full w-full overflow-auto p-8 font-mono text-xs whitespace-pre-wrap bg-white">
                        {ocrResult?.markdownNoHeaders || ocrResult?.html || "No text content yet."}
                    </div>
                )}
            </div>

            {ocrResult && (
                <div className="h-6 border-t bg-background flex items-center px-4 text-[0.65rem] text-muted-foreground justify-between">
                    <span>Model: {ocrResult.model}</span>
                    <span>Processed: {new Date(ocrResult.createdAt).toLocaleString()}</span>
                </div>
            )}
        </div>
    );
};
