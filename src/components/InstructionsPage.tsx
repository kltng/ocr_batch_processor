import React from "react";
import { Button } from "./ui/button";

interface InstructionsPageProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InstructionsPage: React.FC<InstructionsPageProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-background border rounded-lg shadow-lg w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="instructions-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 id="instructions-title" className="text-2xl font-semibold">User Guide & Instructions</h2>
                    <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0" aria-label="Close Guide">
                        <span className="sr-only">Close</span>
                        ✕
                    </Button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 text-foreground">

                    {/* Section: Intro */}
                    <section>
                        <h3 className="text-xl font-bold mb-3">Welcome to LM Studio OCR</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            This application allows you to perform privacy-focused, local OCR (Optical Character Recognition) using
                            <strong> LM Studio</strong>, <strong>Ollama</strong>, or cloud-based OCR using <strong>Google Gemini</strong>.
                            Convert your documents, PDFs, and images into clean, structured Markdown or HTML with bounding boxes.
                        </p>
                    </section>

                    {/* Section: LM Studio */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm">Local</span>
                            Using with LM Studio
                        </h3>
                        <div className="bg-muted/50 p-6 rounded-lg border space-y-4">
                            <ol className="list-decimal list-inside space-y-3 text-sm md:text-base">
                                <li>
                                    <strong>Download LM Studio:</strong> Visit <a href="https://lmstudio.ai" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">lmstudio.ai</a> and install the application.
                                </li>
                                <li>
                                    <strong>Get a Vision Model:</strong> Open LM Studio, search for a vision-capable model.
                                    <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                        <li>Recommended: <code>Chandra-OCR</code>.</li>
                                        <li>Ensure the model card says "Vision" or "Multimodal".</li>
                                    </ul>
                                </li>
                                <li>
                                    <strong>Load the Model:</strong> Go to the <strong>Local Server</strong> tab (the double arrow icon generic server) and load your downloaded model.
                                </li>
                                <li>
                                    <strong>Start Server:</strong> Click the green <strong>Start Server</strong> button.
                                    <br />
                                    <em>Default settings (Port 1234) usually work perfectly.</em>
                                </li>
                                <li>
                                    <strong>Connect App:</strong> In this app, click <strong>Settings (⚙️)</strong>, select <strong>LM Studio</strong>, and ensure the Base URL is <code>http://localhost:1234</code>.
                                </li>
                            </ol>
                        </div>
                    </section>

                    {/* Section: Google Gemini */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">Cloud</span>
                            Using with Google Gemini
                        </h3>
                        <div className="bg-muted/50 p-6 rounded-lg border space-y-4">
                            <ol className="list-decimal list-inside space-y-3 text-sm md:text-base">
                                <li>
                                    <strong>Get API Key:</strong> Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a> and create a new API Key.
                                </li>
                                <li>
                                    <strong>Configure App:</strong> In this app, click <strong>Settings (⚙️)</strong> and select <strong>Google Gemini</strong>.
                                </li>
                                <li>
                                    <strong>Enter Key:</strong> Paste your API Key into the "Google API Key" field.
                                </li>
                                <li>
                                    <strong>Select Model:</strong> Choose a model like <code>gemini-2.0-flash-exp</code> or <code>gemini-1.5-flash</code>.
                                </li>
                            </ol>
                        </div>
                    </section>

                    {/* Section: Ollama */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">Local</span>
                            Using with Ollama
                        </h3>
                        <div className="bg-muted/50 p-6 rounded-lg border space-y-4">
                            <ol className="list-decimal list-inside space-y-3 text-sm md:text-base">
                                <li>
                                    <strong>Install Ollama:</strong> Visit <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">ollama.com</a> and install the application.
                                </li>
                                <li>
                                    <strong>Pull a Vision Model:</strong> Run the following command to get GLM-OCR (recommended for best OCR quality):
                                    <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">ollama pull glm-ocr</pre>
                                    <p className="text-muted-foreground mt-1">Alternative vision models: <code>llava</code>, <code>minicpm-v</code></p>
                                </li>
                                <li>
                                    <strong>Ollama Auto-Starts:</strong> Ollama runs automatically in the background on port 11434.
                                </li>
                                <li>
                                    <strong>Connect App:</strong> In this app, click <strong>Settings (⚙️)</strong>, select <strong>Ollama</strong>, and ensure:
                                    <ul className="list-disc list-inside ml-6 mt-1 text-muted-foreground">
                                        <li>Base URL is <code>http://localhost:11434</code></li>
                                        <li>Model is <code>glm-ocr</code> (or your pulled model name)</li>
                                    </ul>
                                </li>
                            </ol>
                            <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-xs">
                                <strong className="text-blue-700 dark:text-blue-300">Why GLM-OCR?</strong>
                                <p className="text-blue-600 dark:text-blue-400 mt-1">GLM-OCR is a specialized OCR model that excels at document understanding, table recognition, and formula extraction. It's optimized for accuracy and works great with this application.</p>
                            </div>
                        </div>
                    </section>

                    {/* Section: General Usage */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold">How to Use</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">📂 File Management</h4>
                                <p className="text-sm text-muted-foreground">
                                    Click <strong>Open Folder</strong> to select a workspace containing your images or PDFs.
                                    The sidebar will list all supported files. Click a file to view it.
                                </p>
                            </div>

                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">🔍 Running OCR</h4>
                                <p className="text-sm text-muted-foreground">
                                    Select one or multiple files in the sidebar (Shift+Click).
                                    Click <strong>Run OCR</strong> in the toolbar.
                                    The app will process files one by one (or in batches) and save results as <code>.json</code> sidecar files.
                                </p>
                            </div>

                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">✂️ PDF Tools</h4>
                                <p className="text-sm text-muted-foreground">
                                    Use <strong>PDF to Images</strong> to convert PDF pages into individual JPEGs for better OCR accuracy.
                                    Use <strong>Split Pages</strong> to cut double-page scans into single pages automatically.
                                </p>
                            </div>

                            <div className="border p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">👁️ Viewing Results</h4>
                                <p className="text-sm text-muted-foreground">
                                    Toggle between <strong>Original</strong>, <strong>Annotated</strong> (shows bounding boxes),
                                    and <strong>Markdown</strong> views in the main viewer panel.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section: Troubleshooting */}
                    <section className="space-y-4 pt-4 border-t">
                        <h3 className="text-xl font-bold text-amber-600">Troubleshooting</h3>
                        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                            <li>
                                <strong>LM Studio Connection Error:</strong> If connection fails, check <strong>CORS</strong> in LM Studio Server Options. Ensure it is enabled.
                            </li>
                            <li>
                                <strong>Network Error:</strong> Ensure the Base URL is correct (default <code>http://localhost:1234</code>).
                            </li>
                            <li>
                                <strong>Empty Results:</strong> Verify your model is Vision-capable (e.g., <code>Qwen-VL</code>). Text-only models cannot see images.
                            </li>
                        </ul>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-muted/20 flex justify-end">
                    <Button onClick={onClose}>Close Guide</Button>
                </div>
            </div>
        </div>
    );
};
