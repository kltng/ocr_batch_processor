import React from "react";
import { X } from "lucide-react";
import { BatchProgress } from "../hooks/useBatchProcessor";
import { Button } from "./ui/button";

interface BatchProgressBarProps {
  progress: BatchProgress;
  onCancel: () => void;
}

export const BatchProgressBar: React.FC<BatchProgressBarProps> = ({
  progress,
  onCancel,
}) => {
  const { total, completed, skipped, errors, currentFile, isRunning } = progress;
  const done = completed + skipped + errors;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[0.65rem] text-muted-foreground whitespace-nowrap">
            {done}/{total}
          </span>
        </div>
        <p className="text-[0.6rem] text-muted-foreground truncate">
          {currentFile}
        </p>
      </div>
      {isRunning && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={onCancel}
          title="Cancel batch"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
};
