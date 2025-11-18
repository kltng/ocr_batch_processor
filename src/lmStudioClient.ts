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
};

type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: unknown };
  }>;
};

export async function requestOcrHtml({
  config,
  promptType,
  imageDataUrl
}: OcrRequest): Promise<string> {
  const { baseUrl, model, apiKey } = config;

  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${trimmedBase}/v1/chat/completions`;

  const messages: ChatCompletionMessage[] = [
    {
      role: "system",
      content: getPrompt(promptType)
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Perform OCR on this image and return HTML as described in the system prompt."
        },
        {
          type: "image_url",
          image_url: {
            url: imageDataUrl
          }
        }
      ]
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
      messages,
      stream: false
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `LM Studio request failed with status ${resp.status}: ${text}`
    );
  }

  const data = (await resp.json()) as ChatCompletionResponse;
  const content =
    data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

  return parseOcrResponse(content);
}

