import { getOrCreateSubdirectory, writeFile } from "./filesystem";
import { OcrStoredResult } from "./ocrStore";

const OCR_OUTPUT_DIR = "ocr_outputs";

/**
 * Quick existence check — does an .ocr.json file exist for this source file?
 * Does not parse JSON; just checks if the file handle exists.
 */
export async function checkOcrExists(
    workDir: FileSystemDirectoryHandle,
    originalFileName: string
): Promise<boolean> {
    try {
        const ocrDir = await workDir.getDirectoryHandle(OCR_OUTPUT_DIR);
        const baseName = originalFileName.replace(/\.[^/.]+$/, "");
        await ocrDir.getFileHandle(`${baseName}.ocr.json`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Saves the OCR result as a JSON file in the ocr_outputs subdirectory.
 */
export async function saveOcrResultToFs(
    workDir: FileSystemDirectoryHandle,
    originalFileName: string,
    data: Omit<OcrStoredResult, "key" | "model" | "createdAt"> & {
        model: string;
        createdAt?: number;
    }
): Promise<void> {
    const ocrDir = await getOrCreateSubdirectory(workDir, OCR_OUTPUT_DIR);
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    const jsonFileName = `${baseName}.ocr.json`;

    const record: OcrStoredResult = {
        key: `${Math.random().toString(36).substring(7)}`, // Key is less relevant for FS but keeping structure
        imageName: originalFileName,
        model: data.model,
        createdAt: data.createdAt ?? Date.now(),
        html: data.html,
        markdownWithHeaders: data.markdownWithHeaders,
        markdownNoHeaders: data.markdownNoHeaders,
        annotatedImageDataUrl: data.annotatedImageDataUrl,
    };

    const jsonContent = JSON.stringify(record, null, 2);
    await writeFile(ocrDir, jsonFileName, jsonContent);
}

/**
 * Attempts to load an OCR result JSON for a given file.
 */
export async function loadOcrResultFromFs(
    workDir: FileSystemDirectoryHandle,
    originalFileName: string
): Promise<OcrStoredResult | null> {
    try {
        const ocrDir = await workDir.getDirectoryHandle(OCR_OUTPUT_DIR);
        const baseName = originalFileName.replace(/\.[^/.]+$/, "");
        const jsonFileName = `${baseName}.ocr.json`;

        const fileHandle = await ocrDir.getFileHandle(jsonFileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text) as OcrStoredResult;
        return data;
    } catch (e) {
        // File not found or error reading/parsing
        return null;
    }
}
