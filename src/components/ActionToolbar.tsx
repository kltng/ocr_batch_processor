import React from "react";
import { Button } from "./ui/button";

interface ActionToolbarProps {
    isProcessing: boolean;
    statusMessage: string;
    onRunOcr: () => void;
    onSplitPages: () => void;
    onConvertPdf: () => void;
    selectedCount: number;
    onOpenSettings: () => void;
    skipExisting: boolean;
    setSkipExisting: (val: boolean) => void;
    onOpenHelp: () => void;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
    isProcessing,
    statusMessage,
    onRunOcr,
    onSplitPages,
    onConvertPdf,
    selectedCount,
    onOpenSettings,
    skipExisting,
    setSkipExisting,
    onOpenHelp,
}) => {
    const hasSelection = selectedCount > 0;

    return (
        <div className="h-14 border-b flex items-center px-4 gap-4 bg-background justify-between">
            <div className="flex items-center gap-2">
                <Button
                    onClick={onRunOcr}
                    disabled={isProcessing || !hasSelection}
                    size="sm"
                    className="gap-2"
                >
                    {isProcessing ? "Processing..." : `Run OCR${selectedCount > 1 ? ` (${selectedCount})` : ""}`}
                </Button>

                <div className="h-6 w-px bg-border mx-1" />

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSplitPages}
                    disabled={isProcessing || !hasSelection}
                >
                    {`Split Pages${selectedCount > 1 ? ` (${selectedCount})` : ""}`}
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onConvertPdf}
                    disabled={isProcessing || !hasSelection}
                >
                    {`PDF to Images${selectedCount > 1 ? ` (${selectedCount})` : ""}`}
                </Button>

                <div className="ml-4 flex items-center gap-2">
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

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isProcessing && <span className="animate-spin mr-1">⏳</span>}
                    <span>{statusMessage}</span>
                </div>

                <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                    Settings
                </Button>
                <Button variant="ghost" size="sm" onClick={onOpenHelp}>
                    Help
                </Button>
            </div>
        </div>
    );
};
