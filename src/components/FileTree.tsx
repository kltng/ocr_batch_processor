import React from "react";
import { FileTreeNode } from "../types/fileTree";
import { cn } from "../lib/utils";
import { ChevronRight, Folder, FolderOpen, FileImage, FileText, CheckCircle2, Loader2 } from "lucide-react";

interface FileTreeProps {
  nodes: FileTreeNode[];
  expandedDirs: Set<string>;
  selectedIds: Set<string>;
  onToggleDir: (id: string) => void;
  onFileClick: (node: FileTreeNode, e: React.MouseEvent) => void;
  depth?: number;
}

function getFileIcon(name: string) {
  if (/\.pdf$/i.test(name)) return <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
  return <FileImage className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
}

function OcrStatusDot({ status }: { status: FileTreeNode["ocrStatus"] }) {
  if (status === "done") {
    return <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />;
  }
  if (status === "processing") {
    return <Loader2 className="w-3 h-3 text-amber-500 animate-spin flex-shrink-0" />;
  }
  return null;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  expandedDirs,
  selectedIds,
  onToggleDir,
  onFileClick,
  depth = 0,
}) => {
  return (
    <div>
      {nodes.map((node) => {
        if (node.kind === "directory") {
          const isExpanded = expandedDirs.has(node.id);
          return (
            <div key={node.id}>
              <button
                onClick={() => onToggleDir(node.id)}
                className="w-full text-left flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-accent transition-colors select-none"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                <ChevronRight
                  className={cn(
                    "w-3 h-3 text-muted-foreground transition-transform flex-shrink-0",
                    isExpanded && "rotate-90"
                  )}
                />
                {isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                )}
                <span className="truncate font-medium">{node.name}</span>
                {node.children && (
                  <span className="text-[0.6rem] text-muted-foreground ml-auto flex-shrink-0">
                    {node.children.filter((c) => c.kind === "file").length}
                  </span>
                )}
              </button>
              {isExpanded && node.children && (
                <FileTree
                  nodes={node.children}
                  expandedDirs={expandedDirs}
                  selectedIds={selectedIds}
                  onToggleDir={onToggleDir}
                  onFileClick={onFileClick}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        // File node
        const isSelected = selectedIds.has(node.id);
        return (
          <button
            key={node.id}
            onClick={(e) => onFileClick(node, e)}
            className={cn(
              "w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors select-none",
              isSelected
                ? "bg-primary text-primary-foreground font-medium"
                : "hover:bg-accent text-foreground hover:text-accent-foreground"
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            title={node.id}
          >
            {getFileIcon(node.name)}
            <span className="truncate flex-1">{node.name}</span>
            <OcrStatusDot status={node.ocrStatus} />
          </button>
        );
      })}
    </div>
  );
};
