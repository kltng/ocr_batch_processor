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

export function parseOcrResponse(rawContent: unknown): string {
  try {
    if (rawContent == null) {
      return "";
    }

    const asString =
      typeof rawContent === "string"
        ? rawContent
        : typeof rawContent === "object" && "content" in (rawContent as any)
        ? String((rawContent as any).content ?? "")
        : String(rawContent);

    try {
      const parsed = JSON.parse(asString);

      if (typeof parsed === "object" && parsed !== null) {
        if (Array.isArray(parsed)) {
          const firstItem = parsed[0];
          if (firstItem && typeof firstItem === "object" && "label" in firstItem && "bbox" in firstItem) {
            return convertGlmLayoutToHtml(parsed as GlmOcrRegion[]);
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

