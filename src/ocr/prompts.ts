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
  "ad",
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

export const GLM_OCR_LABELS = [
  "abstract",
  "algorithm",
  "aside_text",
  "chart",
  "content",
  "display_formula",
  "doc_title",
  "figure_title",
  "footer",
  "footnote",
  "formula_number",
  "header",
  "image",
  "inline_formula",
  "number",
  "paragraph_title",
  "reference",
  "reference_content",
  "seal",
  "table",
  "text",
  "vertical_text",
  "vision_footnote"
];

export const GLM_OCR_LAYOUT_PROMPT = `
You are an OCR assistant. Analyze the image and output a JSON array of document regions.

**Output Format:**
Return a JSON array where each element has:
- "label": one of [${GLM_OCR_LABELS.join(", ")}]
- "bbox": [x0, y0, x1, y1] normalized to 0-1000 based on image dimensions
- "content": the text content in Markdown format

**Label Descriptions:**
- doc_title: Main document title
- section_header / paragraph_title: Section or paragraph headings
- content / text: Regular body text
- abstract: Abstract section
- table: Table content (output as Markdown table)
- display_formula / inline_formula: Mathematical formulas (output as LaTeX)
- figure_title: Figure captions
- image / chart: Image or chart regions (describe briefly)
- header / footer: Page headers and footers
- footnote / vision_footnote: Footnotes
- reference / reference_content: References and citations
- seal: Seals or stamps
- algorithm: Algorithm blocks
- code: Code blocks

**Guidelines:**
1. Detect all text regions and assign appropriate labels
2. Bounding boxes should tightly wrap each region
3. Preserve reading order in the array
4. For tables, output content as Markdown table syntax
5. For formulas, use LaTeX notation
6. Do not fabricate content not present in the image

**Example Output:**
[
  {"label": "doc_title", "bbox": [100, 50, 900, 120], "content": "# Document Title"},
  {"label": "paragraph_title", "bbox": [100, 150, 600, 180], "content": "## Introduction"},
  {"label": "text", "bbox": [100, 200, 900, 400], "content": "This is the body text..."},
  {"label": "table", "bbox": [100, 450, 900, 700], "content": "| Col1 | Col2 |\\n|------|------|\\n| A | B |"},
  {"label": "display_formula", "bbox": [200, 750, 800, 820], "content": "$$E = mc^2$$"}
]

Output ONLY the JSON array, no additional text.
`.trim();

export type PromptProfile = "chandra_html_layout" | "chandra_html" | "glm_ocr_markdown" | "glm_ocr_layout";

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
    description: "Simple Markdown output. Optimized for GLM-OCR via Ollama.",
    prompt: GLM_OCR_PROMPT
  },
  glm_ocr_layout: {
    name: "GLM-OCR (JSON + Layout)",
    description: "JSON output with labels and bounding boxes. Full layout detection for GLM-OCR.",
    prompt: GLM_OCR_LAYOUT_PROMPT
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

