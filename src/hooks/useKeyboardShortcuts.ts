import { useEffect } from "react";

interface ShortcutActions {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPrevFile: () => void;
  onNextFile: () => void;
  onRunOcr: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focused on an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "a") {
        e.preventDefault();
        actions.onSelectAll();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        actions.onDeselectAll();
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        actions.onPrevFile();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        actions.onNextFile();
        return;
      }

      if (isMod && e.key === "Enter") {
        e.preventDefault();
        actions.onRunOcr();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
