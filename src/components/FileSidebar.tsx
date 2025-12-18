import React, { useMemo } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface FileSidebarProps {
    files: File[];
    selectedFiles: File[];
    onSelectionChange: (files: File[]) => void;
    className?: string;
    onOpenFolder?: () => void;
    hasFolder: boolean;
}

export const FileSidebar: React.FC<FileSidebarProps> = ({
    files,
    selectedFiles,
    onSelectionChange,
    className,
    onOpenFolder,
    hasFolder,
}) => {
    const sortedFiles = useMemo(() => {
        return [...files].sort((a, b) => a.name.localeCompare(b.name));
    }, [files]);

    const handleFileClick = (file: File, e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey) {
            // Toggle
            if (selectedFiles.find(f => f.name === file.name)) {
                onSelectionChange(selectedFiles.filter(f => f.name !== file.name));
            } else {
                onSelectionChange([...selectedFiles, file]);
            }
        } else if (e.shiftKey && selectedFiles.length > 0) {
            // Range select (simplified: just add from last selected to this one)
            // For proper range, we need index.
            const lastSelected = selectedFiles[selectedFiles.length - 1];
            const startIdx = sortedFiles.findIndex(f => f.name === lastSelected.name);
            const endIdx = sortedFiles.findIndex(f => f.name === file.name);

            const low = Math.min(startIdx, endIdx);
            const high = Math.max(startIdx, endIdx);

            const range = sortedFiles.slice(low, high + 1);
            // Merge unique
            const newSelection = [...selectedFiles];
            range.forEach(f => {
                if (!newSelection.find(sel => sel.name === f.name)) {
                    newSelection.push(f);
                }
            });
            onSelectionChange(newSelection);
        } else {
            // Single select
            onSelectionChange([file]);
        }
    };

    return (
        <div className={cn("flex flex-col h-full border-r bg-muted/10", className)}>
            <div className="p-4 border-b">
                <h2 className="text-sm font-semibold mb-2">Files</h2>
                {!hasFolder && (
                    <Button onClick={onOpenFolder} size="sm" variant="default" className="w-full">
                        Open Folder
                    </Button>
                )}
                {hasFolder && (
                    <Button onClick={onOpenFolder} size="sm" variant="outline" className="w-full text-xs h-7">
                        Change Folder
                    </Button>
                )}
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
                {files.length === 0 && hasFolder && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                        No supported files found.
                    </p>
                )}
                {sortedFiles.map((file) => {
                    const isSelected = !!selectedFiles.find(f => f.name === file.name);
                    return (
                        <button
                            key={file.name}
                            onClick={(e) => handleFileClick(file, e)}
                            className={cn(
                                "w-full text-left px-3 py-2 rounded-md text-xs truncate transition-colors select-none",
                                isSelected
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "hover:bg-accent text-foreground hover:text-accent-foreground"
                            )}
                            title={file.name}
                        >
                            {file.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
