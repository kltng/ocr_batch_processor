import { getPrompt, PromptType } from "./ocr/prompts";
import { parseOcrResponse } from "./ocr/parseOcrResponse";

export type GeminiConfig = {
    apiKey: string;
    model: string;
};

export type GeminiOcrRequest = {
    config: GeminiConfig;
    promptType: PromptType;
    imageDataUrl: string; // "data:image/jpeg;base64,..."
    customSystemPrompt?: string;
};

export async function requestGeminiOcr({
    config,
    promptType,
    imageDataUrl,
    customSystemPrompt
}: GeminiOcrRequest): Promise<string> {
    const { apiKey, model } = config;

    if (!apiKey) {
        throw new Error("Google API Key is missing. Please check Settings.");
    }

    // Extract base64 part
    // Data URL format: data:[<mediatype>][;base64],<data>
    const base64Data = imageDataUrl.split(",")[1];
    const mimeType = imageDataUrl.split(":")[1].split(";")[0];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = {
        role: "user", // Gemini often takes system-like prompts as user parts or system_instruction if supported.
        // However, v1beta :generateContent supports `system_instruction` field now for some models,
        // but standard user prompt with clear instruction works robustly across versions.
        // Let's stick to the method that works: Combine prompt + image in "user" content parts.
        parts: [
            { text: customSystemPrompt || getPrompt(promptType) },
            { text: "Perform OCR on this image and return HTML as described above." },
            {
                inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                }
            }
        ]
    };

    const payload = {
        contents: [systemInstruction],
        generationConfig: {
            temperature: 0.1, // Low temp for OCR accuracy
            maxOutputTokens: 8192 // Ensure enough tokens for full page text
        }
    };

    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        throw new Error(`Gemini API request failed (${resp.status}): ${errorText}`);
    }

    const data = await resp.json();

    // Parse response
    // { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Gemini API returned no text content.");
    }

    return parseOcrResponse(text);
}

export async function testGeminiConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    if (!apiKey) {
        return { success: false, message: "API key is required" };
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const resp = await fetch(url, { method: "GET" });

        if (!resp.ok) {
            const errorText = await resp.text().catch(() => "");
            if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
                return { success: false, message: `Invalid API key (${resp.status})` };
            }
            return { success: false, message: `Connection failed (${resp.status}): ${errorText}` };
        }

        const data = await resp.json();
        const modelCount = data.models?.length ?? 0;
        return { success: true, message: `Connected successfully (${modelCount} models available)` };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, message: `Connection error: ${message}` };
    }
}
