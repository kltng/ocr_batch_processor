export function htmlToMarkdown(
  htmlContent: string,
  includeHeadersFooters: boolean
): string {
  if (!htmlContent) {
    return "";
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    if (!includeHeadersFooters) {
      const labeledDivs = doc.querySelectorAll<HTMLElement>("div[data-label]");
      labeledDivs.forEach((div) => {
        const label = (div.getAttribute("data-label") ?? "").toLowerCase();
        if (label === "page-header" || label === "page-footer") {
          div.remove();
        }
      });
    }

    let processedHtml = doc.body ? doc.body.innerHTML : htmlContent;

    processedHtml = processedHtml.replace(/<br\s*\/?>/gi, "\n");

    processedHtml = processedHtml.replace(
      /<(b|strong)[^>]*>(.*?)<\/\1>/gis,
      (_, __, inner) => `**${inner}**`
    );

    processedHtml = processedHtml.replace(
      /<(i|em)[^>]*>(.*?)<\/\1>/gis,
      (_, __, inner) => `*${inner}*`
    );

    processedHtml = processedHtml.replace(
      /<h([1-6])[^>]*>(.*?)<\/h\1>/gis,
      (_match, level, inner) =>
        `\n\n${"#".repeat(Number(level))} ${inner}\n\n`
    );

    processedHtml = processedHtml.replace(
      /<p[^>]*>(.*?)<\/p>/gis,
      (_match, inner) => `\n\n${inner}`
    );

    processedHtml = processedHtml.replace(/<\/?[^>]+>/g, "");

    const cleaned = processedHtml
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");

    return cleaned.trim();
  } catch {
    return htmlContent;
  }
}

