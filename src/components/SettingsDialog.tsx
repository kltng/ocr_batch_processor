import React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    baseUrl: string;
    setBaseUrl: (val: string) => void;
    model: string;
    setModel: (val: string) => void;
    apiKey: string;
    setApiKey: (val: string) => void;
    systemPrompt: string;
    setSystemPrompt: (val: string) => void;
    defaultSystemPrompt: string;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
    isOpen,
    onClose,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    apiKey,
    setApiKey,
    systemPrompt,
    setSystemPrompt,
    defaultSystemPrompt,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-background border rounded-lg shadow-lg flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">Settings</h2>
                    <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="space-y-2">
                        <Label htmlFor="baseUrl">LM Studio Base URL</Label>
                        <Input
                            id="baseUrl"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="http://localhost:1234"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="model">Model Name</Label>
                        <Input
                            id="model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="e.g. compvis/ocr-model"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key (Optional)</Label>
                        <Input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="lm-studio"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="systemPrompt">System Prompt</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setSystemPrompt(defaultSystemPrompt)}
                            >
                                Reset Default
                            </Button>
                        </div>
                        <Textarea
                            id="systemPrompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="min-h-[150px] font-mono text-xs"
                        />
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end">
                    <Button onClick={onClose}>Done</Button>
                </div>
            </div>
        </div>
    );
};
