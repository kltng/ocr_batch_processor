import React, { useCallback, useMemo, useRef } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { FileTree } from "./FileTree";
import { FileToolbar } from "./FileToolbar";
import { FileTreeNode } from "../types/fileTree";
import { FolderOpen } from "lucide-react";

interface FileSidebarProps {
    tree: FileTreeNode[];
    expandedDirs: Set<string>;
    onToggleDir: (id: string) => void;
    selectedIds: Set<string>;
    onSelectionChange: (ids: Set<string>) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onCollapseAll: () => void;
    totalFileCount: number;
    className?: string;
    onOpenFolder?: () => void;
    hasFolder: boolean;
}

/** Flatten all file node IDs from tree */
function flattenFileIds(nodes: FileTreeNode[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
        if (node.kind === "file") ids.push(node.id);
        if (node.children) ids.push(...flattenFileIds(node.children));
    }
    return ids;
}

/** Flatten file nodes in tree order for range selection */
function flattenFileNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    const result: FileTreeNode[] = [];
    for (const node of nodes) {
        if (node.kind === "file") result.push(node);
        if (node.children) result.push(...flattenFileNodes(node.children));
    }
    return result;
}

export const FileSidebar: React.FC<FileSidebarProps> = ({
    tree,
    expandedDirs,
    onToggleDir,
    selectedIds,
    onSelectionChange,
    searchQuery,
    onSearchChange,
    onCollapseAll,
    totalFileCount,
    className,
    onOpenFolder,
    hasFolder,
}) => {
    const lastClickedRef = useRef<string | null>(null);

    const allFileNodes = useMemo(() => flattenFileNodes(tree), [tree]);

    const handleFileClick = useCallback(
        (node: FileTreeNode, e: React.MouseEvent) => {
            if (e.metaKey || e.ctrlKey) {
                // Toggle individual
                const next = new Set(selectedIds);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                onSelectionChange(next);
                lastClickedRef.current = node.id;
            } else if (e.shiftKey && lastClickedRef.current) {
                // Range select
                const startIdx = allFileNodes.findIndex((n) => n.id === lastClickedRef.current);
                const endIdx = allFileNodes.findIndex((n) => n.id === node.id);
                if (startIdx >= 0 && endIdx >= 0) {
                    const low = Math.min(startIdx, endIdx);
                    const high = Math.max(startIdx, endIdx);
                    const next = new Set(selectedIds);
                    for (let i = low; i <= high; i++) {
                        next.add(allFileNodes[i].id);
                    }
                    onSelectionChange(next);
                }
            } else {
                // Single select
                onSelectionChange(new Set([node.id]));
                lastClickedRef.current = node.id;
            }
        },
        [selectedIds, onSelectionChange, allFileNodes]
    );

    const handleSelectAll = useCallback(() => {
        const allIds = flattenFileIds(tree);
        onSelectionChange(new Set(allIds));
    }, [tree, onSelectionChange]);

    const handleDeselectAll = useCallback(() => {
        onSelectionChange(new Set());
    }, [onSelectionChange]);

    return (
        <div className={cn("flex flex-col h-full border-r bg-muted/10", className)}>
            <div className="p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold">Files</h2>
                </div>
                {!hasFolder && (
                    <Button onClick={onOpenFolder} size="sm" variant="default" className="w-full gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open Folder
                    </Button>
                )}
                {hasFolder && (
                    <Button onClick={onOpenFolder} size="sm" variant="outline" className="w-full text-xs h-7 gap-1.5">
                        <FolderOpen className="w-3 h-3" />
                        Change Folder
                    </Button>
                )}
            </div>

            {hasFolder && (
                <FileToolbar
                    searchQuery={searchQuery}
                    onSearchChange={onSearchChange}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    onCollapseAll={onCollapseAll}
                    hasSelection={selectedIds.size > 0}
                />
            )}

            <div className="flex-1 overflow-auto p-1">
                {tree.length === 0 && hasFolder && (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                        No supported files found.
                    </p>
                )}
                <FileTree
                    nodes={tree}
                    expandedDirs={expandedDirs}
                    selectedIds={selectedIds}
                    onToggleDir={onToggleDir}
                    onFileClick={handleFileClick}
                />
            </div>

            {hasFolder && totalFileCount > 0 && (
                <div className="h-7 border-t flex items-center justify-between px-3 text-[0.65rem] text-muted-foreground">
                    <span>{totalFileCount} files</span>
                    {selectedIds.size > 0 && <span>{selectedIds.size} selected</span>}
                </div>
            )}
        </div>
    );
};
