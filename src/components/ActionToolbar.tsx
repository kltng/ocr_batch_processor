import React from "react";
import { Button } from "./ui/button";
import { SplitOrder } from "../lib/pdfTools";
import { BatchProgress } from "../hooks/useBatchProcessor";
import { BatchProgressBar } from "./BatchProgressBar";
import { ScanLine, Scissors, FileImage, Settings, HelpCircle } from "lucide-react";

interface ActionToolbarProps {
    isProcessing: boolean;
    progress: BatchProgress;
    onRunOcr: () => void;
    onSplitPages: () => void;
    onConvertPdf: () => void;
    onCancelBatch: () => void;
    selectedCount: number;
    onOpenSettings: () => void;
    skipExisting: boolean;
    setSkipExisting: (val: boolean) => void;
    onOpenHelp: () => void;
    splitOrder: SplitOrder;
    setSplitOrder: (val: SplitOrder) => void;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
    isProcessing,
    progress,
    onRunOcr,
    onSplitPages,
    onConvertPdf,
    onCancelBatch,
    selectedCount,
    onOpenSettings,
    skipExisting,
    setSkipExisting,
    onOpenHelp,
    splitOrder,
    setSplitOrder,
}) => {
    const hasSelection = selectedCount > 0;

    return (
        <div className="h-14 border-b flex items-center px-4 gap-4 bg-background justify-between">
            <div className="flex items-center gap-2">
                <Button
                    onClick={onRunOcr}
                    disabled={isProcessing || !hasSelection}
                    size="sm"
                    className="gap-1.5"
                    title="Run OCR (Ctrl+Enter)"
                >
                    <ScanLine className="w-3.5 h-3.5" />
                    {isProcessing ? "Processing..." : `OCR${selectedCount > 1 ? ` (${selectedCount})` : ""}`}
                </Button>

                <div className="h-6 w-px bg-border mx-1" />

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSplitPages}
                    disabled={isProcessing || !hasSelection}
                    className="gap-1.5"
                    title="Split double pages into halves"
                >
                    <Scissors className="w-3.5 h-3.5" />
                    Split{selectedCount > 1 ? ` (${selectedCount})` : ""}
                </Button>

                <select
                    value={splitOrder}
                    onChange={(e) => setSplitOrder(e.target.value as SplitOrder)}
                    className="h-8 px-2 rounded border border-input bg-background text-xs cursor-pointer"
                    title="Page reading order: Left-to-Right or Right-to-Left"
                >
                    <option value="LR">L-R</option>
                    <option value="RL">R-L</option>
                </select>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onConvertPdf}
                    disabled={isProcessing || !hasSelection}
                    className="gap-1.5"
                    title="Convert PDF pages to JPEG images"
                >
                    <FileImage className="w-3.5 h-3.5" />
                    PDF to Img{selectedCount > 1 ? ` (${selectedCount})` : ""}
                </Button>

                <div className="ml-2 flex items-center gap-2">
                    <input
                        id="skipToggle"
                        type="checkbox"
                        checked={skipExisting}
                        onChange={(e) => setSkipExisting(e.target.checked)}
                        className="cursor-pointer"
                    />
                    <label htmlFor="skipToggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                        Skip processed
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
                {(progress.isRunning || progress.total > 0) && (
                    <div className="max-w-xs flex-1 min-w-0">
                        <BatchProgressBar progress={progress} onCancel={onCancelBatch} />
                    </div>
                )}

                <Button variant="ghost" size="sm" onClick={onOpenSettings} className="gap-1.5 flex-shrink-0" title="Settings">
                    <Settings className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onOpenHelp} className="gap-1.5 flex-shrink-0" title="Help">
                    <HelpCircle className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
};
