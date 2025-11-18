import JSZip from "jszip";
import type { OcrStoredResult } from "../storage/ocrStore";

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(",");
  const isBase64 = meta.includes("base64");
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const mimeMatch = meta.match(/data:([^;]+);?/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  return new Blob([bytes], { type: mime });
}

function getBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) {
    return filename;
  }
  return filename.slice(0, lastDot);
}

export async function exportAllToDirectory(
  dirHandle: any,
  results: OcrStoredResult[]
): Promise<void> {
  if (!dirHandle || typeof dirHandle.getDirectoryHandle !== "function") {
    throw new Error("Directory handle is not supported in this browser.");
  }

  const outputDir = await dirHandle.getDirectoryHandle("output", {
    create: true
  });
  const htmlDir = await outputDir.getDirectoryHandle("html_with_labels", {
    create: true
  });
  const mdWithDir = await outputDir.getDirectoryHandle(
    "markdown_with_headers",
    { create: true }
  );
  const mdDir = await outputDir.getDirectoryHandle("markdown", {
    create: true
  });
  const imagesDir = await outputDir.getDirectoryHandle("images_with_bboxes", {
    create: true
  });

  const writeFile = async (
    directory: any,
    filename: string,
    content: string | Blob
  ) => {
    const handle = await directory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    if (typeof content === "string") {
      await writable.write(content);
    } else {
      await writable.write(content);
    }
    await writable.close();
  };

  for (const result of results) {
    const baseName = getBaseName(result.imageName);

    if (result.html) {
      const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OCR Result - ${result.imageName}</title>
  </head>
  <body>
${result.html}
  </body>
</html>`;
      await writeFile(htmlDir, `${baseName}.html`, fullHtml);
    }

    if (result.markdownWithHeaders) {
      await writeFile(
        mdWithDir,
        `${baseName}.md`,
        result.markdownWithHeaders
      );
    }

    if (result.markdownNoHeaders) {
      await writeFile(mdDir, `${baseName}.md`, result.markdownNoHeaders);
    }

    if (result.annotatedImageDataUrl) {
      const blob = dataUrlToBlob(result.annotatedImageDataUrl);
      await writeFile(imagesDir, `${baseName}_bboxes.png`, blob);
    }
  }
}

export async function makeZipBlob(
  results: OcrStoredResult[]
): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder("output");
  if (!root) {
    throw new Error("Failed to create zip folder");
  }

  const htmlDir = root.folder("html_with_labels");
  const mdWithDir = root.folder("markdown_with_headers");
  const mdDir = root.folder("markdown");
  const imagesDir = root.folder("images_with_bboxes");

  for (const result of results) {
    const baseName = getBaseName(result.imageName);

    if (result.html && htmlDir) {
      const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OCR Result - ${result.imageName}</title>
  </head>
  <body>
${result.html}
  </body>
</html>`;
      htmlDir.file(`${baseName}.html`, fullHtml);
    }

    if (result.markdownWithHeaders && mdWithDir) {
      mdWithDir.file(`${baseName}.md`, result.markdownWithHeaders);
    }

    if (result.markdownNoHeaders && mdDir) {
      mdDir.file(`${baseName}.md`, result.markdownNoHeaders);
    }

    if (result.annotatedImageDataUrl && imagesDir) {
      const blob = dataUrlToBlob(result.annotatedImageDataUrl);
      imagesDir.file(`${baseName}_bboxes.png`, blob);
    }
  }

  return zip.generateAsync({ type: "blob" });
}

