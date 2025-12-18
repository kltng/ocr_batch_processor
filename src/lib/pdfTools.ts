import * as pdfjsLib from "pdfjs-dist";
import { writeFile, getOrCreateSubdirectory } from "../storage/filesystem";

// Configure worker. In a Vite app, we can usually point to the file in node_modules or a CDN.
// For simplicity and compatibility, we'll try to set it to a CDN or local public path if we copy it.
// However, importing it as a URL is the most Vite-friendly way if configured.
// For this PWA, we'll try the standard CDN approach or specific version import if possible.
// NOTE: We'll set the workerSrc dynamically based on the version installed.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

export async function convertPdfToJpegs(
    file: File,
    outputDir: FileSystemDirectoryHandle
): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const targetDir = await getOrCreateSubdirectory(outputDir, "converted_jpegs");

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High quality
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Could not get canvas context");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport,
        } as any).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.9)
        );

        if (blob) {
            await writeFile(
                targetDir,
                `${file.name.replace(/\.pdf$/i, "")}_page_${i}.jpg`,
                blob
            );
        }
    }
}

export type SplitOrder = "LR" | "RL";

export async function splitPdfPages(
    file: File,
    outputDir: FileSystemDirectoryHandle,
    splitOrder: SplitOrder = "LR"
): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const targetDir = await getOrCreateSubdirectory(outputDir, "split_jpegs");

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Render at high quality
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Could not get canvas context");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport,
        } as any).promise;

        const pageNum = String(i).padStart(4, "0");
        await splitAndSaveCanvas(
            canvas,
            targetDir,
            `${file.name.replace(/\.pdf$/i, "")}_page_${pageNum}`,
            splitOrder
        );
    }
}

export async function splitImage(
    file: File,
    outputDir: FileSystemDirectoryHandle,
    splitOrder: SplitOrder = "LR"
): Promise<void> {
    const targetDir = await getOrCreateSubdirectory(outputDir, "split_jpegs");
    const bitmap = await createImageBitmap(file);

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.drawImage(bitmap, 0, 0);

    // Use original extension or default to jpg, but request asked for jpegs output generally.
    // We'll stick to jpg output for consistency with the folder name "split_jpegs".
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    await splitAndSaveCanvas(canvas, targetDir, baseName, splitOrder);
}

async function splitAndSaveCanvas(
    canvas: HTMLCanvasElement,
    targetDir: FileSystemDirectoryHandle,
    baseName: string,
    splitOrder: SplitOrder = "LR"
): Promise<void> {
    const width = canvas.width;
    const height = canvas.height;
    const mid = Math.floor(width / 2);

    // Determine which suffix goes to which side based on splitOrder
    // LR: Left is first (A), Right is second (B)
    // RL: Right is first (A), Left is second (B)
    const leftSuffix = splitOrder === "LR" ? "A" : "B";
    const rightSuffix = splitOrder === "LR" ? "B" : "A";

    // Left Page
    const canvasL = document.createElement("canvas");
    canvasL.width = mid;
    canvasL.height = height;
    const ctxL = canvasL.getContext("2d");
    ctxL?.drawImage(canvas, 0, 0, mid, height, 0, 0, mid, height);

    const blobL = await new Promise<Blob | null>((resolve) =>
        canvasL.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (blobL) {
        await writeFile(targetDir, `${baseName}_${leftSuffix}.jpg`, blobL);
    }

    // Right Page
    const canvasR = document.createElement("canvas");
    canvasR.width = width - mid;
    canvasR.height = height;
    const ctxR = canvasR.getContext("2d");
    // Source x starts at mid
    ctxR?.drawImage(canvas, mid, 0, width - mid, height, 0, 0, width - mid, height);

    const blobR = await new Promise<Blob | null>((resolve) =>
        canvasR.toBlob(resolve, "image/jpeg", 0.9)
    );
    if (blobR) {
        await writeFile(targetDir, `${baseName}_${rightSuffix}.jpg`, blobR);
    }
}

