import { useState, useCallback, useRef } from "react";
import { FileTreeNode } from "../types/fileTree";
import { scanDirectoryRecursive } from "../storage/filesystem";

export interface UseFileTreeReturn {
  tree: FileTreeNode[];
  expandedDirs: Set<string>;
  toggleDir: (id: string) => void;
  expandDir: (id: string) => void;
  collapseAll: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredTree: FileTreeNode[];
  refresh: (autoExpandDirs?: string[]) => Promise<void>;
  totalFileCount: number;
  setNodeOcrStatus: (id: string, status: FileTreeNode["ocrStatus"]) => void;
}

function countFiles(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "file") count++;
    if (node.children) count += countFiles(node.children);
  }
  return count;
}

function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      if (node.name.toLowerCase().includes(lower)) {
        result.push(node);
      }
    } else if (node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }
  }
  return result;
}

function flattenFileIds(nodes: FileTreeNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.kind === "file") ids.push(node.id);
    if (node.children) ids.push(...flattenFileIds(node.children));
  }
  return ids;
}

/** Collect all directory IDs that have matching descendants */
function collectExpandedForFilter(nodes: FileTreeNode[], query: string): Set<string> {
  const dirs = new Set<string>();
  if (!query) return dirs;
  const lower = query.toLowerCase();

  function walk(n: FileTreeNode[]): boolean {
    let hasMatch = false;
    for (const node of n) {
      if (node.kind === "file" && node.name.toLowerCase().includes(lower)) {
        hasMatch = true;
      }
      if (node.kind === "directory" && node.children) {
        if (walk(node.children)) {
          dirs.add(node.id);
          hasMatch = true;
        }
      }
    }
    return hasMatch;
  }
  walk(nodes);
  return dirs;
}

function updateNodeStatus(
  nodes: FileTreeNode[],
  id: string,
  status: FileTreeNode["ocrStatus"]
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, ocrStatus: status };
    if (node.children) {
      return { ...node, children: updateNodeStatus(node.children, id, status) };
    }
    return node;
  });
}

export function useFileTree(workDirHandle: FileSystemDirectoryHandle | null): UseFileTreeReturn {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const scanIdRef = useRef(0);

  const refresh = useCallback(
    async (autoExpandDirs?: string[]) => {
      if (!workDirHandle) return;
      const currentScanId = ++scanIdRef.current;
      const scanned = await scanDirectoryRecursive(workDirHandle, workDirHandle);
      // Guard against stale scans
      if (scanIdRef.current !== currentScanId) return;
      setTree(scanned);

      if (autoExpandDirs && autoExpandDirs.length > 0) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          autoExpandDirs.forEach((d) => next.add(d));
          return next;
        });
      }
    },
    [workDirHandle]
  );

  const toggleDir = useCallback((id: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandDir = useCallback((id: string) => {
    setExpandedDirs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedDirs(new Set());
  }, []);

  const setNodeOcrStatus = useCallback(
    (id: string, status: FileTreeNode["ocrStatus"]) => {
      setTree((prev) => updateNodeStatus(prev, id, status));
    },
    []
  );

  // When searching, auto-expand directories containing matches
  const filteredTree = searchQuery ? filterTree(tree, searchQuery) : tree;
  const searchExpandedDirs = searchQuery
    ? collectExpandedForFilter(tree, searchQuery)
    : new Set<string>();

  // Merge manual expanded + search-expanded
  const effectiveExpanded = searchQuery
    ? new Set([...expandedDirs, ...searchExpandedDirs])
    : expandedDirs;

  return {
    tree,
    expandedDirs: effectiveExpanded,
    toggleDir,
    expandDir,
    collapseAll,
    searchQuery,
    setSearchQuery,
    filteredTree,
    refresh,
    totalFileCount: countFiles(tree),
    setNodeOcrStatus,
  };
}

export { flattenFileIds };
