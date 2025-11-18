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

