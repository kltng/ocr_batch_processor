import React from "react";
import { cn } from "../../lib/utils";

interface WorkspaceLayoutProps {
    sidebar: React.ReactNode;
    toolbar: React.ReactNode;
    content: React.ReactNode;
    className?: string;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    sidebar,
    toolbar,
    content,
    className,
}) => {
    return (
        <div className={cn("flex h-screen w-screen overflow-hidden bg-background text-foreground", className)}>
            <aside className="w-64 flex-shrink-0 z-10">
                {sidebar}
            </aside>
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
