// NuExtract 3 (NuMind) is a structured-extraction VLM, not a transcriber.
// You give it a JSON "template" describing the fields you want; it returns a
// JSON object filling in those fields with verbatim values from the image.
// Served through LM Studio's native /api/v1/chat, same as the OCR models.

export type NuExtractConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type NuExtractRequest = {
  config: NuExtractConfig;
  template: string;
  imageDataUrl: string;
};

type LmStudioInput =
  | { type: "text"; content: string }
  | { type: "image"; data_url: string };

type LmStudioChatResponse = {
  output: Array<{ type: string; content: string }>;
};

/**
 * Run a template-based extraction. Returns the model's JSON output as a
 * pretty-printed string (re-serialized when parseable, raw otherwise).
 */
export async function requestNuExtract({
  config,
  template,
  imageDataUrl
}: NuExtractRequest): Promise<string> {
  const { baseUrl, model, apiKey } = config;
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${trimmedBase}/api/v1/chat`;

  // NuExtract is sensitive to template formatting: a pretty-printed (multi-line)
  // template gets mistaken for document content and the model falls back to plain
  // OCR. Compact it to a single line so it reliably returns structured JSON. The
  // UI still shows/edits the readable multi-line form.
  let compactTemplate = template;
  try {
    compactTemplate = JSON.stringify(JSON.parse(template));
  } catch {
    // Not valid JSON (user mid-edit); send as-is rather than blocking.
  }

  const input: LmStudioInput[] = [
    {
      // NuExtract is trained to fill in a template; hand it the template verbatim.
      type: "text",
      content: `# Template:\n${compactTemplate}`
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
    body: JSON.stringify({ model, input })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `NuExtract request failed with status ${resp.status}: ${text}`
    );
  }

  const data = (await resp.json()) as LmStudioChatResponse;
  const outputs = data.output ?? [];
  const message =
    outputs.find(o => o.type === "message") ??
    [...outputs].reverse().find(o => o.type !== "reasoning") ??
    outputs[outputs.length - 1];
  const raw = (message?.content ?? "").trim();

  // The model occasionally wraps JSON in a ```json fence — strip it, then
  // re-serialize for stable, pretty output. Fall back to raw on parse failure.
  const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.stringify(JSON.parse(unfenced), null, 2);
  } catch {
    return raw;
  }
}
