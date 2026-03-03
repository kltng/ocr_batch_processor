import React from "react";
import { Search, CheckSquare, Square, ChevronsDownUp } from "lucide-react";
import { Button } from "./ui/button";

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCollapseAll: () => void;
  hasSelection: boolean;
}

export const FileToolbar: React.FC<FileToolbarProps> = ({
  searchQuery,
  onSearchChange,
  onSelectAll,
  onDeselectAll,
  onCollapseAll,
  hasSelection,
}) => {
  return (
    <div className="flex flex-col gap-1.5 px-2 py-1.5 border-b">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filter files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-7 pl-7 pr-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[0.65rem] gap-1"
          onClick={onSelectAll}
          title="Select All (Ctrl+A)"
        >
          <CheckSquare className="w-3 h-3" />
          All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[0.65rem] gap-1"
          onClick={onDeselectAll}
          disabled={!hasSelection}
          title="Deselect All (Escape)"
        >
          <Square className="w-3 h-3" />
          None
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[0.65rem] gap-1 ml-auto"
          onClick={onCollapseAll}
          title="Collapse All"
        >
          <ChevronsDownUp className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
