import React, { useEffect, useState } from "react";
import { OcrStoredResult } from "../storage/ocrStore";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface DocumentViewerProps {
    file: File | null;
    ocrResult: OcrStoredResult | null;
    className?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
    file,
    ocrResult,
    className,
}) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"split" | "text">("split");

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

    if (!file) {
        return (
            <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
                <p>No file selected</p>
            </div>
        );
    }

    const hasAnnotation = !!ocrResult?.annotatedImageDataUrl;

    return (
        <div className={cn("flex flex-col h-full overflow-hidden", className)}>
            {/* Viewer Toolbar */}
            <div className="h-10 border-b flex items-center justify-between px-4 bg-muted/20">
                <span className="text-xs font-medium truncate max-w-[300px]">{file.name}</span>
                {hasAnnotation && (
                    <div className="flex bg-muted rounded-md p-0.5">
                        <button
                            onClick={() => setViewMode("split")}
                            className={cn("px-2 py-0.5 text-[0.65rem] rounded-sm", viewMode === "split" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
                        >
                            Split View
                        </button>
                        <button
                            onClick={() => setViewMode("text")}
                            className={cn("px-2 py-0.5 text-[0.65rem] rounded-sm", viewMode === "text" ? "bg-white shadow text-foreground" : "text-muted-foreground")}
                        >
                            Text View
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative">
                {viewMode === "split" ? (
                    <div className="flex h-full w-full">
                        {/* Left Pane: Original */}
                        <div className={cn("h-full overflow-auto bg-muted/5 flex items-center justify-center p-4", hasAnnotation ? "w-1/2 border-r" : "w-full")}>
                            {objectUrl && (
                                <img src={objectUrl} alt="Original" className="max-h-full max-w-full object-contain shadow-sm" />
                            )}
                            {file.type === "application/pdf" && !objectUrl && (
                                <div className="text-center text-muted-foreground">
                                    <p className="text-4xl mb-2">📄</p>
                                    <p className="text-sm">PDF Preview</p>
                                    <p className="text-xs mt-1">Convert to images to view pages.</p>
                                </div>
                            )}
                        </div>

                        {/* Right Pane: Annotated (if exists) */}
                        {hasAnnotation && (
                            <div className="w-1/2 h-full overflow-auto bg-muted/5 flex items-center justify-center p-4">
                                <img src={ocrResult!.annotatedImageDataUrl} alt="Annotated" className="max-h-full max-w-full object-contain shadow-sm" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full w-full overflow-auto p-8 font-mono text-xs whitespace-pre-wrap bg-white">
                        {ocrResult?.markdownNoHeaders || ocrResult?.html}
                    </div>
                )}
            </div>

            {/* Quick metadata footer */}
            {ocrResult && (
                <div className="h-6 border-t bg-background flex items-center px-4 text-[0.65rem] text-muted-foreground justify-between">
                    <span>Model: {ocrResult.model}</span>
                    <span>Processed: {new Date(ocrResult.createdAt).toLocaleString()}</span>
                </div>
            )}
        </div>
    );
};
