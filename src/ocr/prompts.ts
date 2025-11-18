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

export type PromptType = "ocr_layout" | "ocr";

export function getPrompt(promptType: PromptType): string {
  return promptType === "ocr_layout" ? OCR_LAYOUT_PROMPT : OCR_PROMPT;
}

