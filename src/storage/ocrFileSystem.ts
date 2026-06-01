import { getOrCreateSubdirectory, writeFile } from "./filesystem";
import { OcrStoredResult } from "./ocrStore";

const OCR_OUTPUT_DIR = "ocr_outputs";

function splitSourcePath(sourcePath: string): { dirParts: string[]; filename: string; jsonFileName: string } {
    const parts = sourcePath.split("/").filter(Boolean);
    const filename = parts.pop() ?? sourcePath;
    const baseName = filename.replace(/\.[^/.]+$/, "");
    return {
        dirParts: parts,
        filename,
        jsonFileName: `${baseName}.ocr.json`
    };
}

async function getNestedDirectory(
    dirHandle: FileSystemDirectoryHandle,
    dirParts: string[],
    create: boolean
): Promise<FileSystemDirectoryHandle> {
    let current = dirHandle;
    for (const part of dirParts) {
        current = await current.getDirectoryHandle(part, { create });
    }
    return current;
}

/**
 * Quick existence check — does an .ocr.json file exist for this source file?
 * Does not parse JSON; just checks if the file handle exists.
 */
export async function checkOcrExists(
    workDir: FileSystemDirectoryHandle,
    sourcePath: string
): Promise<boolean> {
    const { dirParts, jsonFileName } = splitSourcePath(sourcePath);
    try {
        const ocrDir = await workDir.getDirectoryHandle(OCR_OUTPUT_DIR);
        const targetDir = await getNestedDirectory(ocrDir, dirParts, false);
        await targetDir.getFileHandle(jsonFileName);
        return true;
    } catch {
        if (dirParts.length > 0) return false;
        try {
            // Backward compatibility for older root-level flat ocr_outputs/name.ocr.json files.
            const ocrDir = await workDir.getDirectoryHandle(OCR_OUTPUT_DIR);
            await ocrDir.getFileHandle(jsonFileName);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Saves the OCR result as a JSON file in the ocr_outputs subdirectory.
 */
export async function saveOcrResultToFs(
    workDir: FileSystemDirectoryHandle,
    sourcePath: string,
    data: Omit<OcrStoredResult, "key" | "model" | "createdAt"> & {
        model: string;
        createdAt?: number;
    }
): Promise<void> {
    const ocrDir = await getOrCreateSubdirectory(workDir, OCR_OUTPUT_DIR);
    const { dirParts, filename, jsonFileName } = splitSourcePath(sourcePath);
    const targetDir = await getNestedDirectory(ocrDir, dirParts, true);

    const record: OcrStoredResult = {
        key: `${Math.random().toString(36).substring(7)}`, // Key is less relevant for FS but keeping structure
        imageName: data.imageName || filename,
        sourcePath,
        model: data.model,
        createdAt: data.createdAt ?? Date.now(),
        html: data.html,
        markdownWithHeaders: data.markdownWithHeaders,
        markdownNoHeaders: data.markdownNoHeaders,
        annotatedImageDataUrl: data.annotatedImageDataUrl,
        extraction: data.extraction,
    };

    const jsonContent = JSON.stringify(record, null, 2);
    await writeFile(targetDir, jsonFileName, jsonContent);
}

/**
 * Attempts to load an OCR result JSON for a given file.
 */
export async function loadOcrResultFromFs(
    workDir: FileSystemDirectoryHandle,
    sourcePath: string
): Promise<OcrStoredResult | null> {
    const { dirParts, jsonFileName } = splitSourcePath(sourcePath);

    try {
        const ocrDir = await workDir.getDirectoryHandle(OCR_OUTPUT_DIR);
        const targetDir = await getNestedDirectory(ocrDir, dirParts, false);

        const fileHandle = await targetDir.getFileHandle(jsonFileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text) as OcrStoredResult;
        if (!data.sourcePath) data.sourcePath = sourcePath;
        return data;
    } catch (e) {
        if (dirParts.length > 0) return null;
        try {
            // Backward compatibility for older root-level flat ocr_outputs/name.ocr.json files.
            const ocrDir = await workDir.getDirectoryHandle(OCR_OUTPUT_DIR);
            const fileHandle = await ocrDir.getFileHandle(jsonFileName);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const data = JSON.parse(text) as OcrStoredResult;
            if (!data.sourcePath) data.sourcePath = sourcePath;
            return data;
        } catch {
            // File not found or error reading/parsing
            return null;
        }
    }
}
