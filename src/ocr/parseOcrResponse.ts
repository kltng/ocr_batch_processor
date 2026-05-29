type GlmOcrRegion = {
  label: string;
  bbox: [number, number, number, number];
  content: string;
};

function convertGlmLayoutToHtml(regions: GlmOcrRegion[]): string {
  const labelToTag: Record<string, string> = {
    doc_title: "h1",
    paragraph_title: "h2",
    section_header: "h2",
    figure_title: "h3",
    abstract: "div",
    content: "div",
    text: "p",
    table: "div",
    display_formula: "div",
    inline_formula: "span",
    image: "div",
    chart: "div",
    header: "header",
    footer: "footer",
    footnote: "aside",
    vision_footnote: "aside",
    reference: "div",
    reference_content: "div",
    seal: "div",
    algorithm: "pre",
    code: "pre",
    number: "span",
    aside_text: "aside",
    formula_number: "span",
    vertical_text: "div"
  };

  const htmlParts: string[] = [];

  for (const region of regions) {
    const tag = labelToTag[region.label] || "div";
    const bbox = region.bbox;
    const bboxStr = `[${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}]`;

    let content = region.content || "";

    if (region.label === "table") {
      content = `<table>${content}</table>`;
    } else if (region.label === "display_formula" || region.label === "inline_formula") {
      content = `<math>${content}</math>`;
    }

    htmlParts.push(
      `<${tag} data-bbox="${bboxStr}" data-label="${region.label}">${content}</${tag}>`
    );
  }

  return htmlParts.join("\n");
}

type DotsOcrRegion = {
  category: string;
  bbox: [number, number, number, number];
  text?: string;
};

// dots.ocr emits a JSON array of layout elements using category/text fields and
// RAW PIXEL bboxes (not normalized like GLM/Chandra). We render the same
// data-bbox HTML, mapping its categories to GLM-style labels, and tag the boxes
// with data-bbox-scale="pixel" so renderBboxes skips coordinate normalization.
function convertDotsLayoutToHtml(regions: DotsOcrRegion[]): string {
  const categoryToTag: Record<string, string> = {
    Title: "h1",
    "Section-header": "h2",
    Caption: "small",
    Footnote: "aside",
    "Page-header": "header",
    "Page-footer": "footer",
    "List-item": "li",
    Formula: "div",
    Table: "div",
    Picture: "div",
    Text: "p"
  };
  const categoryToLabel: Record<string, string> = {
    "Page-header": "Page-Header",
    "Page-footer": "Page-Footer",
    "Section-header": "Section-Header",
    "List-item": "List-Group",
    Title: "Section-Header",
    Caption: "Caption",
    Footnote: "Footnote",
    Formula: "Equation-Block",
    Table: "Table",
    Picture: "Image",
    Text: "Text"
  };

  const htmlParts: string[] = [];
  for (const region of regions) {
    const tag = categoryToTag[region.category] || "div";
    const label = categoryToLabel[region.category] || region.category;
    const bbox = region.bbox;
    const bboxStr = `[${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}]`;

    let content = region.text ?? "";
    if (region.category === "Formula") {
      content = `<math>${content}</math>`;
    }

    htmlParts.push(
      `<${tag} data-bbox="${bboxStr}" data-bbox-scale="pixel" data-label="${label}">${content}</${tag}>`
    );
  }
  return htmlParts.join("\n");
}

// Thinking models sometimes inline their chain-of-thought as <think>...</think>
// (or <thinking>...</thinking>) instead of a separate reasoning block. Strip it
// so the reasoning never leaks into the saved OCR text.
function stripThinking(text: string): string {
  let out = text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "");
  // If only a closing tag survives (opener dropped or output truncated), discard
  // everything up to and including it — that prefix is the reasoning.
  const close = out.match(/<\/think(?:ing)?>/i);
  if (close && close.index !== undefined) {
    out = out.slice(close.index + close[0].length);
  }
  // NuMarkdown-style models wrap the real output in <answer>...</answer>. Unwrap it.
  out = out.replace(/<\/?answer>/gi, "");
  return out.trim();
}

export function parseOcrResponse(rawContent: unknown): string {
  try {
    if (rawContent == null) {
      return "";
    }

    const asString = stripThinking(
      typeof rawContent === "string"
        ? rawContent
        : typeof rawContent === "object" && "content" in (rawContent as any)
        ? String((rawContent as any).content ?? "")
        : String(rawContent)
    );

    try {
      const parsed = JSON.parse(asString);

      if (typeof parsed === "object" && parsed !== null) {
        if (Array.isArray(parsed)) {
          const firstItem = parsed[0];
          if (firstItem && typeof firstItem === "object" && "bbox" in firstItem) {
            // GLM-OCR uses label/content; dots.ocr uses category/text.
            if ("label" in firstItem) {
              return convertGlmLayoutToHtml(parsed as GlmOcrRegion[]);
            }
            if ("category" in firstItem) {
              return convertDotsLayoutToHtml(parsed as DotsOcrRegion[]);
            }
          }
        }

        const obj = parsed as Record<string, unknown>;

        const layoutHtml =
          (obj["layout_html"] as string | undefined) ??
          (obj["structured_html"] as string | undefined);
        if (layoutHtml) {
          return layoutHtml;
        }

        let htmlContent =
          (obj["html"] as unknown) ??
          (obj["content"] as unknown) ??
          (obj["text"] as unknown);

        if (Array.isArray(htmlContent)) {
          const paragraphs: string[] = [];
          for (const item of htmlContent) {
            if (
              item &&
              typeof item === "object" &&
              "paragraph" in (item as any)
            ) {
              paragraphs.push(String((item as any).paragraph));
            } else if (typeof item === "string") {
              paragraphs.push(item);
            }
          }
          htmlContent = paragraphs.join("\n\n");
        }

        if (htmlContent != null) {
          return String(htmlContent);
        }
      }

      return String(parsed);
    } catch {
      return asString;
    }
  } catch {
    return "";
  }
}

