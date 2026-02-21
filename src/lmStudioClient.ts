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

type LmStudioChatResponse = {
  output: Array<{
    type: "message";
    content: string;
  }>;
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
  const content = data.output?.[0]?.content ?? "";

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

