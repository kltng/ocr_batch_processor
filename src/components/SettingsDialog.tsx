import React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export type OcrProvider = "lmstudio" | "google";

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;

    // Provider
    provider: OcrProvider;
    setProvider: (val: OcrProvider) => void;

    // LM Studio Config
    baseUrl: string;
    setBaseUrl: (val: string) => void;
    lmModel: string;
    setLmModel: (val: string) => void;
    lmApiKey: string;
    setLmApiKey: (val: string) => void;

    // Google Config
    googleApiKey: string;
    setGoogleApiKey: (val: string) => void;
    googleModel: string;
    setGoogleModel: (val: string) => void;

    // Shared
    systemPrompt: string;
    setSystemPrompt: (val: string) => void;
    defaultSystemPrompt: string;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
    isOpen,
    onClose,
    provider,
    setProvider,
    baseUrl,
    setBaseUrl,
    lmModel,
    setLmModel,
    lmApiKey,
    setLmApiKey,
    googleApiKey,
    setGoogleApiKey,
    googleModel,
    setGoogleModel,
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
                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <Label>OCR Provider</Label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="provider"
                                    value="lmstudio"
                                    checked={provider === "lmstudio"}
                                    onChange={() => setProvider("lmstudio")}
                                />
                                <span className="text-sm">LM Studio</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="provider"
                                    value="google"
                                    checked={provider === "google"}
                                    onChange={() => setProvider("google")}
                                />
                                <span className="text-sm">Google Gemini</span>
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-border my-2" />

                    {/* LM Studio Fields */}
                    {provider === "lmstudio" && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                                <Label htmlFor="lmModel">Model Name</Label>
                                <Input
                                    id="lmModel"
                                    value={lmModel}
                                    onChange={(e) => setLmModel(e.target.value)}
                                    placeholder="e.g. compvis/ocr-model"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lmApiKey">API Key (Optional)</Label>
                                <Input
                                    id="lmApiKey"
                                    type="password"
                                    value={lmApiKey}
                                    onChange={(e) => setLmApiKey(e.target.value)}
                                    placeholder="lm-studio"
                                />
                            </div>
                        </div>
                    )}

                    {/* Google Fields */}
                    {provider === "google" && (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                                <p>Note: The "Free of Charge" tier has rate limits (e.g. 5 RPM).</p>
                                <p>Batch processing will be throttled automatically.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="googleApiKey">Google API Key</Label>
                                <Input
                                    id="googleApiKey"
                                    type="password"
                                    value={googleApiKey}
                                    onChange={(e) => setGoogleApiKey(e.target.value)}
                                    placeholder="Enter your Gemini API Key"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="googleModel">Model Name</Label>
                                <Input
                                    id="googleModel"
                                    value={googleModel}
                                    onChange={(e) => setGoogleModel(e.target.value)}
                                    placeholder="gemini-3-flash"
                                />
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-border my-2" />

                    {/* Shared System Prompt */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="systemPrompt">System Prompt (OCR Layout)</Label>
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
