import React from "react";
import { cn } from "../../lib/utils";

interface WorkspaceLayoutProps {
    sidebar: React.ReactNode;
    toolbar: React.ReactNode;
    content: React.ReactNode;
    className?: string;
    sidebarWidth: number;
    onResizeMouseDown: (e: React.MouseEvent) => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    sidebar,
    toolbar,
    content,
    className,
    sidebarWidth,
    onResizeMouseDown,
}) => {
    return (
        <div className={cn("flex h-screen w-screen overflow-hidden bg-background text-foreground", className)}>
            <aside className="flex-shrink-0 z-10" style={{ width: sidebarWidth }}>
                {sidebar}
            </aside>
            <div
                className="w-1 flex-shrink-0 cursor-col-resize bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors"
                onMouseDown={onResizeMouseDown}
            />
            <main className="flex-1 flex flex-col min-w-0">
                <header className="flex-shrink-0 z-10">
                    {toolbar}
                </header>
                <div className="flex-1 relative min-h-0">
                    {content}
                </div>
            </main>
        </div>
    );
};
