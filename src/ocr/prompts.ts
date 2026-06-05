export const ALLOWED_TAGS = [
  "math",
  "br",
  "i",
  "b",
  "u",
  "del",
  "sup",
  "sub",
  "table",
  "tr",
  "td",
  "p",
  "th",
  "div",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "ul",
  "ol",
  "li",
  "input",
  "a",
  "span",
  "img",
  "hr",
  "tbody",
  "small",
  "caption",
  "strong",
  "aside",
  "big",
  "code"
] as const;

export const ALLOWED_ATTRIBUTES = [
  "class",
  "colspan",
  "rowspan",
  "display",
  "checked",
  "type",
  "border",
  "value",
  "style",
  "href",
  "alt",
  "align",
  "data-bbox",
  "data-bbox-scale",
  "data-label"
] as const;

const BASE_GUIDELINES = `
* **Inline math:** Surround math with <math>...</math> tags. Math expressions should be rendered in KaTeX-compatible LaTeX. Use display for block math.
* **Tables:** Use colspan and rowspan attributes to match table structure.
* **Formatting:** Maintain consistent formatting with image, including spacing, indentation, subscripts/superscripts, and special characters.
* **Images:** Include a description of any images in alt attribute of an <img> tag. Do not fill out the src property.
* **Forms:** Mark checkboxes and radio buttons properly.
* **Text:** Join lines together properly into paragraphs using <p>...</p> tags. Use <br> tags for line breaks within paragraphs, but only when absolutely necessary to maintain meaning.
* **Use the simplest possible HTML structure** that accurately represents the content of the block.
* **Make sure text is accurate and easy for a human to read and interpret.** Reading order should be correct and natural.
`.trim();

const LAYOUT_GUIDELINES = `
**For layout-based OCR:**
When asked to OCR with layout blocks, arrange content as layout blocks. Each layout block should be a div with data-bbox attribute representing the bounding box of the block in [x0, y0, x1, y1] format. Bboxes are normalized 0-1024. The data-label attribute is the label for the block.
Use the following labels: Caption, Footnote, Equation-Block, List-Group, Page-Header, Page-Footer, Image, Section-Header, Table, Text, Complex-Block, Code-Block, Form, Table-Of-Contents, Figure
`.trim();

export const OCR_LAYOUT_PROMPT = `
You are an OCR (Optical Character Recognition) assistant that converts images to HTML.

**Allowed HTML Tags:**
${ALLOWED_TAGS.join(", ")}

**Allowed HTML Attributes:**
${ALLOWED_ATTRIBUTES.join(", ")}

**Guidelines:**
${BASE_GUIDELINES}

${LAYOUT_GUIDELINES}

Only use the specified tags and attributes. Output clean, valid HTML that accurately represents the input image.
`.trim();

export const OCR_PROMPT = `
You are an OCR (Optical Character Recognition) assistant that converts images to HTML.

**Allowed HTML Tags:**
${ALLOWED_TAGS.join(", ")}

**Allowed HTML Attributes:**
${ALLOWED_ATTRIBUTES.join(", ")}

**Guidelines:**
${BASE_GUIDELINES}

Only use the specified tags and attributes. Output clean, valid HTML that accurately represents the input image.
`.trim();

export const GLM_OCR_PROMPT = `
Recognize the text in the image and output in Markdown format.
Preserve the original layout (headings/paragraphs/tables/formulas).
Do not fabricate content that does not exist in the image.
`.trim();

// NuMarkdown-8B-thinking and similar reasoning OCR models are trained to first
// reason about layout, then emit clean Markdown (sometimes wrapped in <answer>).
// They work best with a short, plain instruction — no HTML/bbox machinery.
export const NUMARKDOWN_PROMPT = `
Convert this document image into clean, well-structured Markdown.
Preserve the reading order, headings, paragraphs, lists, and tables.
Render tables as Markdown tables and math as LaTeX.
Transcribe the original text exactly — do not translate or summarize.
`.trim();

// NuExtract 3 takes a JSON template (the fields to pull out), not a prose
// instruction. This default template suits classical book-page scans; users
// edit it freely in the System Prompt / Template box. "verbatim-string" tells
// NuExtract to copy the value exactly from the image.
export const NUEXTRACT_TEMPLATE = `{
  "title": "verbatim-string",
  "page_numbers": ["verbatim-string"],
  "figures": [
    { "caption": "verbatim-string" }
  ],
  "main_text": "verbatim-string"
}`;

// Template for modern academic books (running header + page number at top, body
// text, then a rule and numbered footnotes at the bottom). "header" is the
// chapter/running title; footnotes keep their marker (①②③ / 1,2,3) alongside
// the citation text. Verified on 孔廟祭祀研究 and 國尚師位 scans.
export const NUEXTRACT_FOOTNOTE_TEMPLATE = `{
  "header": "verbatim-string",
  "page_number": "verbatim-string",
  "main_text": "verbatim-string",
  "footnotes": [
    {
      "marker": "verbatim-string",
      "text": "verbatim-string"
    }
  ]
}`;

export type PromptProfile =
  | "chandra_html_layout"
  | "chandra_html"
  | "glm_ocr_markdown"
  | "numarkdown_thinking"
  | "nuextract_template"
  | "nuextract_footnotes";

// Profiles whose "prompt" is actually a NuExtract JSON template, routed through
// the structured-extraction pipeline instead of OCR-to-HTML.
export const EXTRACTION_PROFILES = new Set<string>([
  "nuextract_template",
  "nuextract_footnotes"
]);

export function isExtractionProfile(profileId: string): boolean {
  return EXTRACTION_PROFILES.has(profileId);
}

export type CustomPromptProfile = {
  id: string; // unique ID (e.g., "custom_" + timestamp)
  name: string;
  description: string;
  prompt: string;
  isCustom: true;
};

export type AnyPromptProfile = PromptProfile | string; // built-in key or custom ID

export const CUSTOM_PROFILES_STORAGE_KEY = "ocr_custom_profiles";

export const PROMPT_PROFILES: Record<PromptProfile, { name: string; description: string; prompt: string }> = {
  chandra_html_layout: {
    name: "Chandra-OCR (HTML + Layout)",
    description: "Full HTML output with bounding boxes and layout blocks. Best for Chandra-OCR, Qwen-VL models.",
    prompt: OCR_LAYOUT_PROMPT
  },
  chandra_html: {
    name: "Chandra-OCR (HTML)",
    description: "HTML output without bounding boxes. Good for general vision-language models.",
    prompt: OCR_PROMPT
  },
  glm_ocr_markdown: {
    name: "GLM-OCR (Markdown)",
    description: "Markdown output. Optimized for GLM-OCR via Ollama. No bounding box support — GLM-OCR outputs text only.",
    prompt: GLM_OCR_PROMPT
  },
  numarkdown_thinking: {
    name: "NuMarkdown (Thinking)",
    description: "Markdown output for reasoning OCR models like NuMarkdown-8B-thinking. The model's <think> reasoning and <answer> wrapper are stripped automatically. No bounding boxes.",
    prompt: NUMARKDOWN_PROMPT
  },
  nuextract_template: {
    name: "NuExtract 3 (Template Extraction)",
    description: "Structured extraction, not transcription. Edit the JSON template below to define the fields to pull from each page; NuExtract returns matching JSON. Use 'verbatim-string' for exact copies.",
    prompt: NUEXTRACT_TEMPLATE
  },
  nuextract_footnotes: {
    name: "NuExtract 3 (Modern Book + Footnotes)",
    description: "Extraction for modern academic books: running header, page number, main text, and numbered footnotes (each with its marker). Edit the template below to adjust fields.",
    prompt: NUEXTRACT_FOOTNOTE_TEMPLATE
  }
};

// === Custom Profile localStorage functions ===

export function loadCustomProfiles(): CustomPromptProfile[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PROFILES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomProfiles(profiles: CustomPromptProfile[]): void {
  localStorage.setItem(CUSTOM_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

export function addCustomProfile(name: string, prompt: string): CustomPromptProfile {
  const profiles = loadCustomProfiles();
  const newProfile: CustomPromptProfile = {
    id: `custom_${Date.now()}`,
    name,
    description: `Custom profile: ${name.substring(0, 50)}${name.length > 50 ? "..." : ""}`,
    prompt,
    isCustom: true
  };
  profiles.push(newProfile);
  saveCustomProfiles(profiles);
  return newProfile;
}

export function deleteCustomProfile(id: string): void {
  const profiles = loadCustomProfiles();
  const filtered = profiles.filter(p => p.id !== id);
  saveCustomProfiles(filtered);
}

export function getCustomProfileById(id: string): CustomPromptProfile | undefined {
  const profiles = loadCustomProfiles();
  return profiles.find(p => p.id === id);
}

// === Combined profile helpers ===

export type ProfileInfo = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isCustom: boolean;
};

export function getAllProfiles(): ProfileInfo[] {
  const builtIn: ProfileInfo[] = Object.entries(PROMPT_PROFILES).map(([key, profile]) => ({
    id: key,
    name: profile.name,
    description: profile.description,
    prompt: profile.prompt,
    isCustom: false
  }));
  
  const custom: ProfileInfo[] = loadCustomProfiles().map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    prompt: p.prompt,
    isCustom: true
  }));
  
  return [...builtIn, ...custom];
}

export function getProfilePrompt(profileId: string): string {
  if (profileId in PROMPT_PROFILES) {
    return PROMPT_PROFILES[profileId as PromptProfile].prompt;
  }
  const custom = getCustomProfileById(profileId);
  return custom?.prompt ?? OCR_PROMPT;
}

export function getProfileInfo(profileId: string): ProfileInfo | undefined {
  if (profileId in PROMPT_PROFILES) {
    const p = PROMPT_PROFILES[profileId as PromptProfile];
    return { id: profileId, name: p.name, description: p.description, prompt: p.prompt, isCustom: false };
  }
  const custom = getCustomProfileById(profileId);
  return custom ? { ...custom } : undefined;
}

export type PromptType = "ocr_layout" | "ocr";

export function getPrompt(promptType: PromptType): string {
  return promptType === "ocr_layout" ? OCR_LAYOUT_PROMPT : OCR_PROMPT;
}

export function getPromptByProfile(profile: PromptProfile): string {
  return PROMPT_PROFILES[profile].prompt;
}
