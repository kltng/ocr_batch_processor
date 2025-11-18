function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for bboxes"));
    img.src = url;
  });
}

export async function renderBboxesFromHtml(
  imageFile: File,
  htmlContent: string
): Promise<string> {
  const objectUrl = URL.createObjectURL(imageFile);

  try {
    const img = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available");
    }

    ctx.drawImage(img, 0, 0);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");

    const blocks = Array.from(
      doc.querySelectorAll<HTMLElement>("div[data-bbox]")
    );

    ctx.lineWidth = 2;
    ctx.textBaseline = "bottom";
    ctx.font = "12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

    for (const div of blocks) {
      const bboxAttr = div.getAttribute("data-bbox");
      const labelAttr = div.getAttribute("data-label") ?? "";

      if (!bboxAttr) {
        continue;
      }

      let coords: number[] = [];
      try {
        const stripped = bboxAttr.replace(/[\[\]]/g, "");
        coords = stripped
          .split(",")
          .map((v) => parseFloat(v.trim()))
          .filter((v) => Number.isFinite(v));
      } catch {
        continue;
      }

      if (coords.length !== 4) {
        continue;
      }

      let [x0Norm, y0Norm, x1Norm, y1Norm] = coords;

      const x0 = Math.max(0, Math.min((x0Norm / 1024) * img.width, img.width));
      const y0 = Math.max(
        0,
        Math.min((y0Norm / 1024) * img.height, img.height)
      );
      const x1 = Math.max(0, Math.min((x1Norm / 1024) * img.width, img.width));
      const y1 = Math.max(
        0,
        Math.min((y1Norm / 1024) * img.height, img.height)
      );

      const labelLower = labelAttr.toLowerCase();
      let color = "rgb(0, 255, 255)";
      if (labelLower.includes("header") || labelLower.includes("title")) {
        color = "rgb(255, 0, 0)";
      } else if (labelLower.includes("footer")) {
        color = "rgb(0, 0, 255)";
      } else if (labelLower.includes("table")) {
        color = "rgb(0, 255, 0)";
      } else if (
        labelLower.includes("image") ||
        labelLower.includes("figure")
      ) {
        color = "rgb(255, 165, 0)";
      }

      ctx.strokeStyle = color;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

      if (labelAttr && y0 > 14) {
        const paddingX = 4;
        const paddingY = 2;
        const metrics = ctx.measureText(labelAttr);
        const textWidth = metrics.width;
        const textHeight = 12;

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(
          x0,
          y0 - textHeight - paddingY * 2,
          textWidth + paddingX * 2,
          textHeight + paddingY * 2
        );

        ctx.fillStyle = color;
        ctx.fillText(labelAttr, x0 + paddingX, y0 - paddingY);
      }
    }

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

