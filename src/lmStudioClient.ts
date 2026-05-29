import { getPrompt, PromptType } from "./ocr/prompts";
import { parseOcrResponse } from "./ocr/parseOcrResponse";

export type LmStudioConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type OcrRequest = {
  config: LmStudioConfig;
  promptType: PromptType;
  imageDataUrl: string;
  customSystemPrompt?: string;
};

type LmStudioInputText = {
  type: "text";
  content: string;
};

type LmStudioInputImage = {
  type: "image";
  data_url: string;
};

type LmStudioInput = LmStudioInputText | LmStudioInputImage;

type LmStudioChatRequest = {
  model: string;
  input: LmStudioInput[];
  system_prompt?: string;
};

type LmStudioOutputItem = {
  // "message" is the answer; "reasoning" is a thinking model's chain-of-thought.
  type: string;
  content: string;
};

type LmStudioChatResponse = {
  output: LmStudioOutputItem[];
};

type LmStudioModelCapabilities = {
  vision?: boolean;
};

type LmStudioModel = {
  key: string;
  type: string;
  capabilities?: LmStudioModelCapabilities;
};

type LmStudioModelsResponse = {
  data: LmStudioModel[];
};

export async function requestOcrHtml({
  config,
  promptType,
  imageDataUrl,
  customSystemPrompt
}: OcrRequest): Promise<string> {
  const { baseUrl, model, apiKey } = config;

  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${trimmedBase}/api/v1/chat`;

  const input: LmStudioInput[] = [
    {
      type: "text",
      content: "Perform OCR on this image and return HTML as described in the system prompt."
    },
    {
      type: "image",
      data_url: imageDataUrl
    }
  ];

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
      input,
      system_prompt: customSystemPrompt || getPrompt(promptType)
    } as LmStudioChatRequest)
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `LM Studio request failed with status ${resp.status}: ${text}`
    );
  }

  const data = (await resp.json()) as LmStudioChatResponse;
  const outputs = data.output ?? [];

  // Thinking models (e.g. NuMarkdown, Chandra-OCR-2) emit a "reasoning" block
  // before the actual "message" block. Picking output[0] blindly would return
  // the chain-of-thought instead of the OCR text. Prefer the message; fall back
  // to the last non-reasoning item, then the last item.
  const message =
    outputs.find(o => o.type === "message") ??
    [...outputs].reverse().find(o => o.type !== "reasoning") ??
    outputs[outputs.length - 1];
  const content = message?.content ?? "";

  return parseOcrResponse(content);
}

export type LmStudioModelInfo = {
  key: string;
  hasVision: boolean;
};

export async function listLmStudioModels(
  baseUrl: string,
  apiKey?: string,
  visionOnly: boolean = false
): Promise<LmStudioModelInfo[]> {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${trimmedBase}/api/v1/models`;

  const resp = await fetch(endpoint, {
    method: "GET",
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `LM Studio models request failed with status ${resp.status}: ${text}`
    );
  }

  const data = (await resp.json()) as LmStudioModelsResponse;

  const models = (data.data ?? []).map(model => ({
    key: model.key,
    hasVision: model.capabilities?.vision ?? false
  }));

  if (visionOnly) {
    return models.filter(m => m.hasVision);
  }

  return models;
}

