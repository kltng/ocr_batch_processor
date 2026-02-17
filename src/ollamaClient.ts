import { getPrompt, PromptType } from "./ocr/prompts";
import { parseOcrResponse } from "./ocr/parseOcrResponse";

export type OllamaConfig = {
  baseUrl: string;
  model: string;
};

export type OllamaOcrRequest = {
  config: OllamaConfig;
  promptType: PromptType;
  imageDataUrl: string; // "data:image/jpeg;base64,..."
  customSystemPrompt?: string;
};

type OllamaGenerateResponse = {
  model: string;
  created_at: string;
  response?: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  error?: string;
};

/**
 * Request OCR from Ollama using the /api/generate endpoint
 * Ollama expects images as base64 strings (without data URL prefix) in an `images` array
 */
export async function requestOllamaOcr({
  config,
  promptType,
  imageDataUrl,
  customSystemPrompt
}: OllamaOcrRequest): Promise<string> {
  const { baseUrl, model } = config;

  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${trimmedBase}/api/generate`;

  // Extract base64 data from data URL
  // Data URL format: data:[<mediatype>][;base64],<data>
  const base64Data = imageDataUrl.split(",")[1];

  // Build the prompt - GLM-OCR works best with clear instructions
  const systemPrompt = customSystemPrompt || getPrompt(promptType);
  const userPrompt = "Perform OCR on this image and return HTML as described in the system prompt.";

  // Combine prompts for Ollama generate format
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const payload = {
    model,
    prompt: fullPrompt,
    images: [base64Data],
    stream: false,
    options: {
      temperature: 0.1, // Low temp for OCR accuracy
      num_predict: 8192 // Ensure enough tokens for full page text
    }
  };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Ollama request failed with status ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as OllamaGenerateResponse;

  // Check for error in response
  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }

  // Ollama /api/generate returns response field with the text
  const content = data.response || data.message?.content || "";

  return parseOcrResponse(content);
}

/**
 * List available models from Ollama
 */
export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${trimmedBase}/api/tags`;

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!resp.ok) {
      return [];
    }

    const data = await resp.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}
